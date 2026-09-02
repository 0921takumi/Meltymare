-- ============================================================
-- v57: 法令違反コンテンツの「配信停止（ハード取り下げ）」を追加
--
-- 背景:
--   v56 までの「却下」は販売を止めるだけで、既に購入した人のダウンロードは
--   止まらない設計だった（購入者は代金を払っているため、通常のガイドライン違反で
--   一方的に取り上げるのは適切でない）。
--   しかし児童ポルノ・無修正・盗撮など法令に触れるものは、購入済みであっても
--   配信を継続してはならない。運営が塞げない穴を残さないため、
--   「通常の却下」と「法令違反による配信停止」を別物として扱えるようにする。
--
--   通常の却下 (rejected)         … 販売停止。購入済みの人はDL可（既得の対価）。
--   配信停止  (hard_takedown)     … 販売停止 + 購入済みの人もDL不可。返金対応が前提。
--
-- Supabase SQL Editor で「全文を選択せずに」そのまま実行してください。
-- 冪等（何度実行しても安全）。
-- ============================================================

-- ── 1) 配信停止フラグ ──
alter table public.contents
  add column if not exists hard_takedown boolean not null default false;

-- 誰がいつ何を理由に止めたかを残す（法令対応の記録として必要）
alter table public.contents
  add column if not exists takedown_reason text,
  add column if not exists takedown_at timestamptz,
  add column if not exists takedown_by uuid references public.profiles(id);

-- ── 2) クリエイターが配信停止フラグを自分で解除できないようにする ──
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
  -- v57: 配信停止の記録はクリエイター側から一切触らせない
  new.hard_takedown := old.hard_takedown;
  new.takedown_reason := old.takedown_reason;
  new.takedown_at := old.takedown_at;
  new.takedown_by := old.takedown_by;

  if new.review_status is distinct from old.review_status then
    new.review_status := old.review_status;
  end if;

  -- 一度でも却下された、または配信停止されたものは、管理者の承認なしに再公開できない
  if new.is_published = true and old.is_published = false
     and (coalesce(old.review_status, 'pending') = 'rejected'
          or coalesce(old.requires_admin_review, false)
          or coalesce(old.hard_takedown, false)) then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_moderation_columns_trg on public.contents;
create trigger protect_contents_moderation_columns_trg
  before update on public.contents
  for each row execute function public.protect_contents_moderation_columns();

-- ── 3) 出品時に配信停止フラグを持ち込めないようにする ──
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
  return new;
end;
$$;

drop trigger if exists protect_contents_insert_trg on public.contents;
create trigger protect_contents_insert_trg
  before insert on public.contents
  for each row execute function public.protect_contents_insert();

-- ── 4) 配信停止したものは公開範囲から完全に外す ──
drop policy if exists "contents_select" on public.contents;
create policy "contents_select" on public.contents
  for select
  using (
    (is_published = true
      and coalesce(review_status, 'approved') <> 'rejected'
      and coalesce(hard_takedown, false) = false)
    or (creator_id = auth.uid() and coalesce(hard_takedown, false) = false)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 確認:
--   1. 管理画面から「配信停止」した商品は、購入者のダウンロードが 403 になること。
--   2. 通常の「却下」では、購入者のダウンロードは従来どおり可能なこと。
--   3. 配信停止した商品はクリエイター本人の管理画面からも見えなくなること（運営のみ閲覧可）。
