-- ============================================================
-- v56: 事後審査(v55)で開いたモデレーションの穴を塞ぐ
--
-- v55適用後に実データで検証したところ、以下が全て「成立してしまう」ことを確認した。
-- 事後審査では「却下＝取り下げ」が唯一の販売停止手段なので、いずれも致命的。
--
--   ① 却下された商品を、クリエイター自身が運営の再審査なしで販売中に戻せる
--      resubmit_content_for_review() で rejected→pending に戻し、続けて
--      is_published=true を書くと、v55のトリガーは old.review_status='pending' を
--      見て素通しする。UI操作だけでも「却下品を編集保存→もう一度公開して保存」で成立し、
--      回数無制限に繰り返せる。運営の却下が事実上「一時的な非表示」に成り下がっていた。
--
--   ② 出品時に review_status='approved' を自分で指定でき、審査キューに一度も載らない
--      contents の特権列保護は BEFORE UPDATE トリガーだけで INSERT に無かった。
--      列の既定値も 'approved'。sold_count も自己申告で書けた（9999 を入れられた）。
--
--   ③ 販売中(pending)の商品にコメントすると RLS で拒否され 500 になる
--      アプリ側(app/api/comment/route.ts)は v55 で「rejectedのみ拒否」に緩めたが、
--      comments_insert ポリシー(v38)は今も review_status='approved' を要求していた。
--
--   ④ contents_select の審査ゲートがそもそも本番に入っていない
--      v27 で入れたはずの review_status ゲートが効いておらず、却下済みでも
--      is_published=true なら未ログインから見えた。v55 の該当部分も未反映だった。
--      （アプリ側は多層防御として既にコードで塞いだが、DB側も正しい状態に戻す）
--
-- Supabase SQL Editor で「全文を選択せずに」そのまま実行してください。
-- ※ 一部だけ選択すると選択範囲しか実行されません（v55で実際に起きた可能性が高い）。
-- 冪等（何度実行しても安全）。
-- ============================================================

-- ── 0) 却下履歴を保持する列を追加 ──
-- 一度でも却下された行は、管理者が明示的に承認するまで再公開させないための旗。
alter table public.contents
  add column if not exists requires_admin_review boolean not null default false;

-- 既に却下済みの行には旗を立てておく（適用時点の実データを正とする）
update public.contents
  set requires_admin_review = true
  where review_status = 'rejected' and requires_admin_review = false;

-- ── 1) 公開範囲: 却下済みは公開しない（v27/v55 の再適用）──
drop policy if exists "contents_select" on public.contents;
create policy "contents_select" on public.contents
  for select
  using (
    (is_published = true and coalesce(review_status, 'approved') <> 'rejected')
    or creator_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 2) UPDATE 保護: 却下されたものは管理者承認まで再公開不可 ──
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
  if actor is null or coalesce(current_setting('myfocus.trusted_content_update', true), '') = 'true' then
    return new;
  end if;

  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;
  end if;

  new.creator_id := old.creator_id;
  new.sold_count := old.sold_count;
  -- 却下フラグ自体もクリエイターには落とさせない
  new.requires_admin_review := old.requires_admin_review;

  if new.review_status is distinct from old.review_status then
    new.review_status := old.review_status;
  end if;

  -- v56: 「今 rejected か」ではなく「一度でも却下されたか」で再公開を止める。
  -- v55 は前者だけを見ていたため、resubmit で pending に戻せば素通りできた。
  if new.is_published = true and old.is_published = false
     and (coalesce(old.review_status, 'pending') = 'rejected'
          or coalesce(old.requires_admin_review, false)) then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_moderation_columns_trg on public.contents;
create trigger protect_contents_moderation_columns_trg
  before update on public.contents
  for each row execute function public.protect_contents_moderation_columns();

-- ── 3) INSERT 保護（新規）: 出品時の自己承認・売上水増しを防ぐ ──
create or replace function public.protect_contents_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  if actor is null then
    return new;  -- service_role（webhook/管理API等）はそのまま通す
  end if;

  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;
  end if;

  -- 出品は必ず「未確認(pending)」から始まり、販売実績はゼロから始まる
  new.creator_id := actor;
  new.review_status := 'pending';
  new.sold_count := 0;
  new.requires_admin_review := false;
  new.rejection_reason := null;
  return new;
end;
$$;

drop trigger if exists protect_contents_insert_trg on public.contents;
create trigger protect_contents_insert_trg
  before insert on public.contents
  for each row execute function public.protect_contents_insert();

-- ── 4) 却下時に「管理者承認待ち」の旗を立てる ──
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
    select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
    if not coalesce(actor_is_admin, false) then
      raise exception 'not authorized for admin override';
    end if;
  end if;

  perform set_config('myfocus.trusted_content_update', 'true', true);

  if p_admin_override then
    -- 管理者の承認だけが「再公開してよい」を意味する（旗を降ろせる唯一の経路）
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end,
          requires_admin_review = case when p_new_status = 'approved' then false
                                       when p_new_status = 'rejected' then true
                                       else requires_admin_review end
      where id = p_content_id;
  else
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end,
          requires_admin_review = case when p_new_status = 'rejected' then true else requires_admin_review end
      where id = p_content_id
        and creator_id = actor
        and review_status = 'pending';
  end if;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- ── 5) 再提出は「審査キューに戻す」だけ。公開許可は与えない ──
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

  -- v56: requires_admin_review はここでは落とさない。
  -- 落とせてしまうと「却下→再提出→自分で公開」で運営の却下を無効化できる。
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

-- ── 6) コメント可否をアプリ側の基準(rejected以外)に合わせる ──
drop policy if exists "comments_insert" on public.content_comments;
create policy "comments_insert" on public.content_comments
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.contents c
      where c.id = content_id
        and c.is_published = true
        and coalesce(c.review_status, 'approved') <> 'rejected'
    )
  );

-- 確認:
--   1. 却下された商品を編集保存→公開ONで保存しても、公開されないこと。
--   2. 管理画面の「承認・公開」を押した後なら公開できること。
--   3. 出品時に review_status='approved' や sold_count=9999 を指定しても、
--      pending / 0 に矯正されること。
--   4. 販売中(pending)の商品にコメントが投稿できること。
--   5. 却下済み商品が未ログインユーザーから見えないこと。
