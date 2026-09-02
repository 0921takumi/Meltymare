-- ============================================================
-- v59: 納品前監査の修正 — 再審査の巻き戻しと動画ゲートのバイパスを塞ぐ
--
-- 1) resubmit_content_for_review
--    v47 は approved 始点（承認済みのサムネ差し替え→再審査）にも対応していたが、
--    v56 で rejected 限定に絞ってしまい、承認済みの差し替えが無審査で公開され続けていた
--    （RPC が false を返すためアプリは AI 審査すら呼ばず、完全に無言で失敗）。
--    rejected / approved / pending のどれからでも再審査に戻せるようにする。
--    v56 の意図（requires_admin_review はここでは落とさない）は維持する。
--    v55(事後審査)以降、写真は再審査中も販売を止めない。動画は承認まで非公開。
--
-- 2) protect_contents_moderation_columns
--    (a) 承認済み/確認済みの本体・サムネを差し替えたら、DB側でも pending に戻す
--        （アプリを経由しない PostgREST 直叩きでも抜けられないように）。
--    (b) 種別(写真/動画)を出品後に変えられないようにし、動画の公開ゲートは
--        old ではなく new の値で判定する。「動画→写真に付け替えて公開→動画に戻す」の
--        2段階更新で承認前の動画を公開できた。
--
-- Supabase SQL Editor で「全文を選択せずに」そのまま実行してください。
-- ⚠️ v55〜v58 を適用済みの環境で実行すること。古い版(v47/v56等)を後から流し直すと
--    ここで塞いだ穴が黙って再オープンする。
-- ============================================================

-- ── 1) 再審査 RPC ──
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

  -- requires_admin_review はここでは落とさない（却下→再提出→自分で公開、を防ぐ）。
  update public.contents
    set review_status = 'pending',
        -- 却下からの再提出と動画は非公開のまま（運営の承認が必要）。写真は販売を止めない。
        is_published = case when review_status = 'rejected' or content_type = 'video' then false else is_published end,
        -- 「AI未実行」として新着・未確認の列に戻す
        ai_verdict = null,
        moderated_at = null
    where id = p_content_id
      and creator_id = actor
      and review_status in ('rejected', 'approved', 'pending');

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- ── 2) 更新時の保護トリガー ──
create or replace function public.protect_contents_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
  media_changed boolean;
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
  -- v59: 種別(写真/動画)は出品後に変えられない（出品画面も編集時は種別を固定している）。
  -- 変えられると「動画→写真に付け替えて公開→動画に戻す」で承認前の動画が公開できた。
  new.content_type := old.content_type;
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

  -- v59(a): 本体・サムネを差し替えたら、承認済み/確認済みでも再審査に戻す
  media_changed := new.file_url is distinct from old.file_url
                or new.thumbnail_url is distinct from old.thumbnail_url;
  if media_changed and coalesce(old.review_status, 'pending') in ('approved', 'pending') then
    new.review_status := 'pending';
    new.ai_verdict := null;
    new.moderated_at := null;
  end if;

  if new.is_published = true and old.is_published = false
     and (coalesce(old.review_status, 'pending') = 'rejected'
          or coalesce(old.requires_admin_review, false)
          or coalesce(old.hard_takedown, false)) then
    new.is_published := false;
  end if;

  -- v59(b): 動画は運営が承認するまで公開できない。old ではなく new で判定し、
  -- 種別の付け替えや差し替え直後の公開も止める
  if new.is_published = true and new.content_type = 'video'
     and coalesce(new.review_status, 'pending') <> 'approved' then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_moderation_columns_trg on public.contents;
create trigger protect_contents_moderation_columns_trg
  before update on public.contents
  for each row execute function public.protect_contents_moderation_columns();

-- ── 3) 念のため: 公開中かつ未承認の動画があれば非公開に戻す ──
update public.contents
  set is_published = false
  where content_type = 'video'
    and is_published = true
    and coalesce(review_status, 'pending') <> 'approved';

-- 確認:
--   select count(*) from pg_proc where proname = 'submit_moderation_result';                        -- 1
--   select prosrc like '%v59(b)%' from pg_proc where proname = 'protect_contents_moderation_columns'; -- true
--   select prosrc like '%''pending'')%' from pg_proc where proname = 'resubmit_content_for_review';  -- true
