-- ============================================================
-- v28: コンテンツの審査(モデレーション)バイパスを防ぐ
--
-- 発見した脆弱性:
--   contents テーブルの UPDATE RLS ポリシー(schema.sql) が
--     create policy "contents_update" on public.contents for update using (creator_id = auth.uid());
--   のみで WITH CHECK が無く、Postgres は USING をそのまま WITH CHECK にも使うため
--   「自分の行なら、どの列でも自由に書き換えられる」状態だった。
--
--   /api/moderate は AI審査結果に基づき review_status を更新するが、実装はただの
--   supabase.from('contents').update(...) なので、devtools 等からクリエイター自身が
--   直接テーブルを叩けば review_status='approved'/is_published=true を自己設定でき、
--   AI審査・運営審査を完全にバイパスして即公開できてしまう（18歳未満禁止・モザイク必須
--   という法的にシビアな審査ルールが無効化される）。sold_count の自己水増しも同様に可能。
--   さらに app/creator/upload/page.tsx の「編集」画面からも、一度 rejected になった
--   コンテンツを再審査なしで「公開する」チェックだけで公開できてしまっていた。
--
--   v26 (supabase_migration_v26_protect_profile_columns.sql) で profiles.identity_status
--   / fee_rate に対して全く同じクラスの脆弱性（自己承認・手数料踏み倒し）を BEFORE UPDATE
--   トリガーで塞いだ実績があるが、contents には同等の保護が入っていなかった。
--
-- 方針:
--   1) BEFORE UPDATE トリガーで、管理者以外による review_status / is_published(未承認→true)
--      / sold_count / creator_id の変更を無効化する。
--   2) review_status の正規の確定（AI審査結果の反映）は submit_moderation_result() という
--      SECURITY DEFINER 関数経由のみに限定する。この関数はトランザクションローカルの
--      設定値でトリガーの保護を一時的に解除する（"trusted" エスケープハッチ）。
--      関数内部で auth.uid() を使って所有権・管理者権限を再検証するため、
--      クライアントから偽の actor_id 等を渡してすり抜けることはできない。
--   3) クリエイターが却下済みコンテンツを編集し再審査を希望する場合のための
--      resubmit_content_for_review() も同様の方式で用意する。
--   4) 管理者(role='admin')は従来通り app/admin/contents/actions.ts の生 update を
--      そのまま使い続けられる（トリガーが admin を素通しするため変更不要）。
--   5) service_role 経由の RPC（increment_sold_count 等、webhook/purchase から呼ばれる）は
--      auth.uid() が null になるため、そのまま素通りする（v26/v27 と同じ前提）。
--
-- Supabase SQL Editor で実行してください。冪等（何度実行しても安全）。
-- ============================================================

-- ── BEFORE UPDATE トリガー: 特権列の自己変更を無効化 ──
create or replace function public.protect_contents_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  -- service_role（webhook/purchase の RPC 経由）や、下記の submit_moderation_result /
  -- resubmit_content_for_review 内からの信頼済み更新はそのまま通す。
  if actor is null or coalesce(current_setting('myfocus.trusted_content_update', true), '') = 'true' then
    return new;
  end if;

  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;  -- 管理者(app/admin/contents/actions.ts)は許可
  end if;

  -- 非管理者・非トラステッド経路（クリエイター本人の直接update等）: 特権列を旧値に戻す
  new.creator_id := old.creator_id;
  new.sold_count := old.sold_count;

  if new.review_status is distinct from old.review_status then
    new.review_status := old.review_status;
  end if;

  -- 却下/未承認から is_published=true への変更は、承認済みでない限り無効化
  if new.is_published = true and old.is_published = false
     and coalesce(old.review_status, 'pending') <> 'approved' then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_moderation_columns_trg on public.contents;
create trigger protect_contents_moderation_columns_trg
  before update on public.contents
  for each row execute function public.protect_contents_moderation_columns();

-- ── AI審査結果の正規の確定経路（クリエイター本人 or 管理者オーバーライド） ──
create or replace function public.submit_moderation_result(
  p_content_id uuid,
  p_new_status text,
  p_admin_override boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
  updated_rows int;
begin
  if p_new_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid review_status: %', p_new_status;
  end if;

  if p_admin_override then
    -- クライアントの申告を信用せず、呼び出し元(auth.uid())が本当にadminかを再検証する
    select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
    if not coalesce(actor_is_admin, false) then
      raise exception 'not authorized for admin override';
    end if;
  end if;

  perform set_config('myfocus.trusted_content_update', 'true', true);

  if p_admin_override then
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end
      where id = p_content_id;
  else
    -- クリエイター自身のAI審査結果の反映: 所有権 + pending からの遷移のみ許可（楽観ロック）。
    -- これにより review_status は必ず「pending → 判定結果」という経路でしか動かせない。
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end
      where id = p_content_id
        and creator_id = actor
        and review_status = 'pending';
  end if;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- ── 却下済みコンテンツの再提出（編集後に再審査キューへ戻す） ──
create or replace function public.resubmit_content_for_review(p_content_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  updated_rows int;
begin
  perform set_config('myfocus.trusted_content_update', 'true', true);

  update public.contents
    set review_status = 'pending',
        is_published = false
    where id = p_content_id
      and creator_id = actor
      and review_status = 'rejected';

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- 確認(任意):
--   一般クリエイターで update contents set review_status='approved', is_published=true
--   where id=自分のcontent を実行しても値が変わらないこと（旧値のまま）。
--   admin.rpc('submit_moderation_result', {p_content_id, p_new_status:'approved'}) を
--   クリエイター自身のセッションから呼ぶと、review_status='pending' のときだけ成功すること。
