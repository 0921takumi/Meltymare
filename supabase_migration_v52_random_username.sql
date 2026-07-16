-- ============================================================
-- v52: signup時のusernameをemailから完全に切り離し、ランダムなIDにする
--
-- 発見した問題: handle_new_user トリガーがこれまで
--   username := split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)
-- という「emailのローカル部(@より前)＋id先頭6文字」でusernameを作っていた。
-- この username は /creator/[username] 等で誰でも見られる公開URL・表示名として
-- 使われるため、事実上メールアドレスの個人情報を全世界に公開している状態だった
-- （実際に本番の実アカウント4件で確認: tsukasa1213dayo_b5d54c,
--   waboku_shinai.0409_f38411, a.la.prima001_9328ad, soborochan0411_dffe30）。
--
-- 修正: emailと一切紐付かない、id(uuid)由来のランダムな文字列に変更する。
-- new.id は Supabase Auth が生成するランダムなUUIDなので、その先頭部分を使えば
-- emailを経由せず個人情報と無関係かつ実質衝突しないIDになる。本人はマイページから
-- 自由に変更できる（app/api/me/username/route.ts、別途追加）。
-- ============================================================

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

  begin
    insert into public.profiles (id, email, username, display_name, avatar_url)
    values (
      new.id,
      new.email,
      -- v52: email由来(split_part(new.email,'@',1))をやめ、id由来のランダム文字列にする。
      'u' || substr(replace(new.id::text, '-', ''), 1, 12),
      coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), '新規ユーザー'),
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- 確認(必須):
--   新規のメール登録(招待コードあり)で profiles.username が
--   「u」+ id先頭12桁(ハイフン無し) の形式になり、emailの文字列を一切含まないこと。
-- ============================================================
