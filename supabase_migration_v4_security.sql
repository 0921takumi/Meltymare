-- ============================================================
-- MyFocus Migration v4 — Security Hardening
-- Supabase SQL Editor で実行してください
--
-- このマイグレーションは RLS を強化し、PII・決済情報への不正アクセスを防ぎます。
-- v1/v2/v3 適用済みの前提。冪等（IF EXISTS/OR REPLACE）に書いてあるので再実行OK。
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles: email を他人から見えないように制限
--    現状 "profiles_select" が using (true) で全カラム公開状態。
--    メールアドレスの列挙を防ぐため、SELECT 時に email を含まないビューを作る。
-- ------------------------------------------------------------

-- public 表示用のビュー（email を除外）
create or replace view public.profiles_public as
select
  id, username, display_name, avatar_url, role, bio,
  twitter_url, instagram_url, tiktok_url, created_at
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- profiles 本体の SELECT ポリシーを絞る: 本人/管理者のみ全カラム、他者は不可
-- ただし既存コードが profiles から直接 email 以外を読んでいるため、
-- 段階的移行: まずは RLS は全件 SELECT 維持、将来的にビュー経由へ移行する方針。
-- 今回は email 列を他ロールから隠すべく column privilege を revoke する。
revoke select (email) on public.profiles from anon;
grant select (id, username, display_name, avatar_url, role, bio,
              twitter_url, instagram_url, tiktok_url, created_at) on public.profiles to anon;
-- authenticated は自分の email を読める必要があるので revoke しない。

-- ------------------------------------------------------------
-- 2. purchases: 管理者/クリエイター本人（自分のコンテンツに対する購入）も参照可に
--    既存ポリシーは user_id = auth.uid() のみ。
--    /creator/orders, /admin/sales 等で参照できるよう拡張。
-- ------------------------------------------------------------
drop policy if exists "purchases_select" on public.purchases;
create policy "purchases_select_owner" on public.purchases
  for select using (user_id = auth.uid());

create policy "purchases_select_creator" on public.purchases
  for select using (
    exists (
      select 1 from public.contents c
      where c.id = purchases.content_id and c.creator_id = auth.uid()
    )
  );

create policy "purchases_select_admin" on public.purchases
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- purchases の更新はサーバー側 Service Role のみに限定
-- RLS では UPDATE ポリシーを作らない = ANONユーザーの update は不可。
-- 既存 insert ポリシーは user_id = auth.uid() で OK（そのまま）。

-- ------------------------------------------------------------
-- 3. contents: role を含めた SELECT（既存で問題なし、念のため確認のみ）
-- ------------------------------------------------------------
-- 既存: is_published = true or creator_id = auth.uid()
-- 管理者が非公開コンテンツを見られるよう拡張
drop policy if exists "contents_select" on public.contents;
create policy "contents_select" on public.contents for select using (
  is_published = true
  or creator_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- contents の DELETE は管理者も可能に
drop policy if exists "contents_delete" on public.contents;
create policy "contents_delete" on public.contents for delete using (
  creator_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ------------------------------------------------------------
-- 4. profiles: role の自己昇格を防ぐ
--    現状 update using (auth.uid() = id) だと role='admin' に書き換え放題。
-- ------------------------------------------------------------
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role は自分では変更不可 = 既存の role と一致している必要
    and role = (select role from public.profiles where id = auth.uid())
  );

-- 管理者は任意ユーザーの role を変更可
create policy "profiles_update_admin" on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ------------------------------------------------------------
-- 5. follows: self-follow を防ぐ CHECK 制約
-- ------------------------------------------------------------
alter table public.follows drop constraint if exists follows_no_self;
alter table public.follows add constraint follows_no_self
  check (follower_id <> creator_id);

-- ------------------------------------------------------------
-- 6. requests: 自己リクエスト防止
-- ------------------------------------------------------------
alter table public.requests drop constraint if exists requests_no_self;
alter table public.requests add constraint requests_no_self
  check (user_id <> creator_id);

-- ------------------------------------------------------------
-- 7. reviews: 自分のコンテンツへのレビュー防止
--    creator 本人が自作レビューで★を稼げないように。
-- ------------------------------------------------------------
create or replace function public.reviews_check_not_own_content()
returns trigger as $$
begin
  if exists (
    select 1 from public.contents c
    where c.id = new.content_id and c.creator_id = new.user_id
  ) then
    raise exception 'Cannot review your own content';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists reviews_not_own_content on public.reviews;
create trigger reviews_not_own_content
  before insert or update on public.reviews
  for each row execute function public.reviews_check_not_own_content();

-- ------------------------------------------------------------
-- 8. coupons: 他人のクーポンを code 指定で参照する際は is_active のみ確認 →
--    既存 select policy で OK。追加で、SELECT 時にクリエイター情報を返さないよう注意
--    （API 側で必要カラムのみ select すること）。
-- ------------------------------------------------------------
-- 変更なし。

-- ------------------------------------------------------------
-- 9. Storage: deliveries バケットは必ず private
-- ------------------------------------------------------------
update storage.buckets set public = false where id = 'deliveries';

-- deliveries への直接アクセスを塞ぐポリシー（署名URL経由のみ許可）
drop policy if exists "deliveries_insert_creator" on storage.objects;
create policy "deliveries_insert_creator" on storage.objects for insert with check (
  bucket_id = 'deliveries' and auth.role() = 'authenticated'
);

drop policy if exists "deliveries_select_none" on storage.objects;
-- SELECT は Service Role/署名URL以外拒否（明示的にポリシーを作らない）

-- ------------------------------------------------------------
-- 10. 監査ログテーブル（管理者操作の記録用）
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- 管理者のみ参照可
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 挿入は authenticated のみ（自分の行動を actor_id = auth.uid() で記録）
drop policy if exists "audit_logs_insert_self" on public.audit_logs;
create policy "audit_logs_insert_self" on public.audit_logs for insert with check (
  actor_id = auth.uid()
);

create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

-- ------------------------------------------------------------
-- 11. increment 系 RPC の security definer 化確認
--    sold_count は creator 以外からも増えるため definer で OK。
-- ------------------------------------------------------------
-- 既存 increment_sold_count は security definer 済み。

-- ============================================================
-- 完了
-- ============================================================
