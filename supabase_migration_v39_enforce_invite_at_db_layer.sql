-- ============================================================
-- v39: メール登録の招待コード必須制をDBレイヤーでも強制する
--
-- 発見した脆弱性（実ファイル検証で確定）:
--   招待制(invite-only)の強制は app/auth/signup/page.tsx のクライアントJSが
--   「/api/invite/verify → /api/invite/redeem → supabase.auth.signUp()」の順で
--   呼ぶことだけに依存していた。app/auth/callback/route.ts の
--   enforceInviteForOAuth() も provider==='email' の場合は
--   「フォーム側で検証済み」という前提で即 'ok' を返す。
--
--   しかし NEXT_PUBLIC_SUPABASE_URL + anon key はどちらも公開情報のため、
--   /api/invite/verify・/api/invite/redeem を一切呼ばずに
--   POST {SUPABASE_URL}/auth/v1/signup を直接叩けば、招待コード無しで
--   アカウントを作成できてしまう。handle_new_user トリガーも招待の有無を
--   一切チェックしていなかった。つまり招待制という機能自体が、
--   サーバーサイドでは何もエンフォースされておらず、UIの体裁だけで
--   成立している状態だった（本番は現在 invite_only=true で稼働中）。
--
-- 方針:
--   auth.users への INSERT を検知する handle_new_user トリガー内で、
--   app_settings.invite_only が true かつ provider='email' の場合のみ、
--   raw_user_meta_data->>'signup_invite_code' が有効な招待コードであることを
--   検証し、無効なら例外を投げて INSERT ごとロールバックする。
--   OAuth(Google)は app/auth/callback/route.ts が事後チェック+アカウント削除で
--   別途対応済みのため、このトリガーの対象外とする（対象にすると、OAuthの
--   正規フローが「行を作ってから事後にmetadataへ招待コードを追記する」設計
--   のため、初回INSERT時点ではsignup_invite_codeがまだ無く誤って弾いてしまう）。
--
-- 🔴🔴🔴 重要な運用ルール:
--   今後 NEXT_PUBLIC_MYFOCUS_INVITE_ONLY を Vercel で切り替える際は、必ず
--   このテーブルの invite_only も同じ値に更新すること（片方だけ変えると
--   アプリの案内文とDBの実際の強制が食い違う）。
--     update public.app_settings set invite_only = true/false where id = true;
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

create table if not exists public.app_settings (
  id boolean primary key default true,
  invite_only boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = true)
);

-- 現在の本番設定(Vercel: NEXT_PUBLIC_MYFOCUS_INVITE_ONLY="true")に合わせて初期化。
-- 既に行があれば変更しない（on conflict do nothing）。
insert into public.app_settings (id, invite_only) values (true, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings for select using (true);
-- insert/update/deleteポリシーは作らない（authenticatedからの直接書き込みは拒否。
-- 変更は運用者がSQL Editorから直接updateする想定）。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_only boolean;
  v_provider text;
  v_code text;
  v_invite record;
begin
  select invite_only into v_invite_only from public.app_settings where id = true;
  v_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');

  -- メール登録のみDB側で招待コードを強制（OAuthはcallback route側で別途対応済み）
  if coalesce(v_invite_only, false) and v_provider = 'email' then
    v_code := upper(trim(coalesce(new.raw_user_meta_data->>'signup_invite_code', '')));
    if v_code = '' then
      raise exception 'invite_required: signup_invite_code missing';
    end if;

    select id, max_uses, used_count, expires_at, is_active
      into v_invite
      from public.invite_codes
      where code = v_code;

    if v_invite.id is null
       or not v_invite.is_active
       or v_invite.used_count >= v_invite.max_uses
       or (v_invite.expires_at is not null and v_invite.expires_at < now())
    then
      raise exception 'invite_invalid: % is not a valid/active invite code', v_code;
    end if;
  end if;

  -- プロフィール作成が失敗しても新規登録自体は止めない（ToC 事故防止）。
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

-- 確認(必須):
--   1) 正しい招待コードを使った通常のメール登録(/auth/signup経由)が今まで通り成功すること。
--   2) 招待コードを一切経由せず直接 POST {SUPABASE_URL}/auth/v1/signup を
--      email/passwordのみで叩くと、auth.users行が作成されずサインアップ自体が失敗すること。
--   3) Google(OAuth)での新規登録が、この変更の影響を受けず今まで通り動作すること
--      （callback route側の招待チェックのみが働く）。
-- ============================================================
