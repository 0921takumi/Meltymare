-- ============================================================
-- v58: 動画を事前審査に戻す + AI審査の実行有無を記録する
--
-- 背景:
--   v55 で事前審査を撤廃したが、その前提だった「AI審査が違反を自動で取り下げる」は
--   本番では成立していない。
--     - AWS Rekognition の認証情報が本番に無く、AI審査は常に「判定不能」を返す
--     - 動画は moderateVideo() が未実装で、そもそも自動審査の手段が無い
--   結果、動画は「誰も見ていないまま即販売」される状態だった。
--
--   写真は AWS を設定すれば自動で止められるが、動画は技術的に手段が無いため、
--   動画だけ事前審査（運営が承認するまで公開しない）に戻す。
--
--   あわせて review_status='pending' が
--     「AIがまだ走っていない」「AIが判定を保留した」「AIが未設定でスキップした」
--   のどれなのか区別できず、運営が「一度も確認されていない商品」を特定できなかったため、
--   AI審査の結果と実行時刻を記録する。
--
-- Supabase SQL Editor で「全文を選択せずに」そのまま実行してください。
-- 冪等（何度実行しても安全）。
-- ============================================================

-- ── 1) AI審査の記録用の列 ──
alter table public.contents
  add column if not exists ai_verdict text,          -- approved / rejected / pending / skip / error / unsupported
  add column if not exists moderated_at timestamptz; -- AI審査を実行した時刻（null = 一度も走っていない）

-- ── 2) 出品時の保護に「動画は公開させない」を追加 ──
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
    return new;
  end if;

  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;
  end if;

  new.creator_id := actor;
  new.review_status := 'pending';
  new.sold_count := 0;
  new.requires_admin_review := false;
  new.rejection_reason := null;
  new.hard_takedown := false;
  new.takedown_reason := null;
  new.takedown_at := null;
  new.takedown_by := null;
  -- AI審査の結果はクリエイターに書かせない
  new.ai_verdict := null;
  new.moderated_at := null;

  -- v58: 動画は自動審査の手段が無いため、運営が承認するまで公開しない（事前審査）
  if new.content_type = 'video' then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_insert_trg on public.contents;
create trigger protect_contents_insert_trg
  before insert on public.contents
  for each row execute function public.protect_contents_insert();

-- ── 3) 更新時: 動画は運営承認前に自力公開させない + AI記録を保護 ──
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
  new.requires_admin_review := old.requires_admin_review;
  new.hard_takedown := old.hard_takedown;
  new.takedown_reason := old.takedown_reason;
  new.takedown_at := old.takedown_at;
  new.takedown_by := old.takedown_by;
  new.ai_verdict := old.ai_verdict;
  new.moderated_at := old.moderated_at;

  if new.review_status is distinct from old.review_status then
    new.review_status := old.review_status;
  end if;

  if new.is_published = true and old.is_published = false
     and (coalesce(old.review_status, 'pending') = 'rejected'
          or coalesce(old.requires_admin_review, false)
          or coalesce(old.hard_takedown, false)
          -- v58: 動画は運営が承認(approved)するまで公開できない
          or (old.content_type = 'video' and coalesce(old.review_status, 'pending') <> 'approved')) then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_moderation_columns_trg on public.contents;
create trigger protect_contents_moderation_columns_trg
  before update on public.contents
  for each row execute function public.protect_contents_moderation_columns();

-- ── 4) 既に公開されている未承認の動画があれば、いったん非公開に戻す ──
-- （事前審査に戻す以上、既存分も運営が確認するまでは出さない）
update public.contents
  set is_published = false
  where content_type = 'video'
    and is_published = true
    and coalesce(review_status, 'pending') <> 'approved';

-- 確認:
--   1. 動画を「公開する」にチェックして出品しても、公開されないこと。
--   2. 管理画面で承認すると公開されること。
--   3. 写真は従来どおり即販売開始されること。

-- ── 5) 【重要な訂正】v56 が復活させてしまった3引数オーバーロードを削除する ──
-- v51 は「3引数版(uuid,text,boolean)と4引数版(uuid,text,boolean,text)が両方生き残ると
-- 呼び出しが曖昧になる」として3引数版を削除していた。ところが v56 が
-- create or replace で3引数版を作り直してしまい、オーバーロードが復活していた。
--
-- 実害: app/api/moderate は p_rejection_reason を渡すため4引数版(v46)に解決される。
-- v46版には v56 で入れた requires_admin_review の処理が無いので、
-- 「AIが却下した商品」だけ再公開ロックが掛からず、クリエイターが自力で復活できてしまう。
--
-- 3引数版を削除し、4引数版に v56/v57 の保護（却下時に再公開ロック）を入れ直す。
drop function if exists public.submit_moderation_result(uuid, text, boolean);

create or replace function public.submit_moderation_result(
  p_content_id uuid,
  p_new_status text,
  p_admin_override boolean default false,
  p_rejection_reason text default null
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
    -- 管理者の承認だけが再公開ロックを解除できる
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end,
          rejection_reason = case when p_new_status = 'rejected' then p_rejection_reason else null end,
          requires_admin_review = case when p_new_status = 'approved' then false
                                       when p_new_status = 'rejected' then true
                                       else requires_admin_review end
      where id = p_content_id;
  else
    -- AI審査結果の反映。却下なら再公開ロックを立てる（クリエイターは自力で戻せない）
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end,
          rejection_reason = case when p_new_status = 'rejected' then p_rejection_reason else null end,
          requires_admin_review = case when p_new_status = 'rejected' then true else requires_admin_review end
      where id = p_content_id
        and creator_id = actor
        and review_status = 'pending';
  end if;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- 確認:
--   4. AIが却下した商品を、クリエイターが編集保存→公開ONにしても公開されないこと。
--   5. submit_moderation_result のオーバーロードが1つだけであること:
--      select count(*) from pg_proc where proname = 'submit_moderation_result';  -- 1 になる
