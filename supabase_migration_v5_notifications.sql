-- Notifications system
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'purchase', 'delivery', 'tip', 'follow', 'request', 'system'
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx on notifications(user_id, read, created_at desc);
create index if not exists notifications_user_created_idx on notifications(user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications
  for update using (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own" on notifications
  for delete using (auth.uid() = user_id);

-- 通知はサーバ側（service_role）からのみ作成する想定のため INSERT ポリシーは付与しない
