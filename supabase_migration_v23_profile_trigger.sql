-- ============================================================
-- v23: 自動プロフィール作成トリガーの再設置（本番未適用だった致命バグの修正）
--
-- 症状: メール登録ユーザーに profiles 行が作られず、ログインしても
--       全ページがログアウト表示になる（getUser は成功するが
--       profiles.select(...).eq('id', uid) が 0 行 → Header user=null）。
--
-- 原因: schema.sql に定義された handle_new_user / on_auth_user_created
--       トリガーが本番 DB に入っていなかった（移行 v4/v9/v18/v22 で
--       取りこぼし）。OAuth は callback で profiles を作るが email 列が
--       NOT NULL なため、トリガー前提の設計になっていた。
--
-- 本SQLは何度実行しても安全（idempotent / on conflict do nothing）。
-- Supabase ダッシュボード → SQL Editor に貼り付けて RUN してください。
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- プロフィール作成が失敗しても新規登録自体は止めない（ToC 事故防止）。
  -- 失敗時は warning を残し、別途バックフィルで拾えるようにする。
  begin
    insert into public.profiles (id, email, username, display_name, avatar_url)
    values (
      new.id,
      new.email,
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6),
      coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 確認用（任意）: 実行後、トリガーが存在することを確認
-- select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
