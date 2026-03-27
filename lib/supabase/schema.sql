-- ==========================================
-- Meltymare Database Schema
-- Supabase SQL Editorで実行してください
-- ==========================================

-- profiles（ユーザー・クリエイター共通）
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'creator', 'admin')),
  bio text,
  twitter_url text,
  instagram_url text,
  tiktok_url text,
  created_at timestamptz default now()
);

-- contents（販売コンテンツ）
create table public.contents (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  price integer not null check (price >= 100),  -- 円単位
  content_type text not null check (content_type in ('image', 'video')),
  thumbnail_url text,
  file_url text not null,
  stock_limit integer,           -- nullは無制限
  sold_count integer default 0,
  is_published boolean default false,
  created_at timestamptz default now()
);

-- purchases（購入履歴）
create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content_id uuid references public.contents(id) on delete cascade not null,
  amount integer not null,
  stripe_payment_intent_id text unique not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz default now(),
  unique(user_id, content_id)  -- 重複購入防止
);

-- ==========================================
-- RLS（Row Level Security）設定
-- ==========================================

alter table public.profiles enable row level security;
alter table public.contents enable row level security;
alter table public.purchases enable row level security;

-- profiles: 誰でも閲覧可、本人のみ更新
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- contents: 公開済みは誰でも閲覧可、クリエイター本人のみCRUD
create policy "contents_select" on public.contents for select using (is_published = true or creator_id = auth.uid());
create policy "contents_insert" on public.contents for insert with check (creator_id = auth.uid());
create policy "contents_update" on public.contents for update using (creator_id = auth.uid());
create policy "contents_delete" on public.contents for delete using (creator_id = auth.uid());

-- purchases: 本人の購入履歴のみ閲覧可
create policy "purchases_select" on public.purchases for select using (user_id = auth.uid());
create policy "purchases_insert" on public.purchases for insert with check (user_id = auth.uid());

-- ==========================================
-- Storageバケット
-- ==========================================

-- コンテンツファイル（購入者のみアクセス可）
insert into storage.buckets (id, name, public) values ('contents', 'contents', false);

-- サムネイル（公開）
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', true);

-- アバター（公開）
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- ==========================================
-- Storageポリシー
-- ==========================================

-- サムネイル・アバターは誰でも閲覧、クリエイターのみアップロード
create policy "thumbnails_select" on storage.objects for select using (bucket_id = 'thumbnails');
create policy "thumbnails_insert" on storage.objects for insert with check (bucket_id = 'thumbnails' and auth.role() = 'authenticated');

create policy "avatars_select" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- コンテンツファイルは購入者のみDL可（Service Roleで制御）
create policy "contents_insert_creator" on storage.objects for insert with check (
  bucket_id = 'contents' and auth.role() = 'authenticated'
);

-- ==========================================
-- 自動プロフィール作成トリガー
-- ==========================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6),
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- sold_countインクリメント関数（Webhook用）
create or replace function public.increment_sold_count(content_id uuid)
returns void as $$
  update public.contents set sold_count = sold_count + 1 where id = content_id;
$$ language sql security definer;
