-- ============================================================
-- v26: profiles の特権列を「本人による自己改ざん」から保護するトリガー
--
-- 発見した脆弱性(本番でテストユーザー実攻撃で確認):
--   🔴 一般ユーザーが自分の profiles を直接 UPDATE して
--      - fee_rate を 0 にできる        → 手数料踏み倒し(収益直撃)
--      - identity_status='approved'    → 本人確認(年齢確認)を運営審査なしでバイパス
--   原因: v22 は PII 列の SELECT を REVOKE したが、これら非PII特権列の
--         自己 UPDATE を塞いでいなかった(RLS の auth.uid()=id 自己更新が通る)。
--
-- 方針: BEFORE UPDATE トリガーで、非管理者の actor が特権列を変更しようとしたら
--       旧値に戻す。本人の正当操作は通す:
--         - プロフィール編集(display_name/bio/avatar/SNS) → 対象外なのでOK
--         - 本人確認の提出(identity_document_url/selfie/birthdate, identity_status='pending')
--           → 'pending'/'unsubmitted' への変更のみ許可、'approved'/'rejected' は admin のみ
--       admin(actor の role='admin') と service_role(auth.uid() is null) は素通り。
--
-- profiles(public)へのトリガーなので Supabase SQL Editor で作成可。冪等。
-- ============================================================

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  -- service_role / 内部処理(トリガー/RPC)は auth.uid() が null → 素通り
  if actor is null then
    return new;
  end if;

  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;  -- 管理者は許可
  end if;

  -- 非管理者: 特権列の自己変更を無効化(旧値に戻す)
  new.role                       := old.role;
  new.fee_rate                   := old.fee_rate;
  new.is_suspended               := old.is_suspended;
  new.suspended_reason           := old.suspended_reason;
  new.suspended_at               := old.suspended_at;
  new.identity_reviewed_at       := old.identity_reviewed_at;
  new.identity_rejection_reason  := old.identity_rejection_reason;

  -- identity_status は本人提出('pending'/'unsubmitted')のみ許可。
  -- 'approved'/'rejected' への自己変更はブロック(運営審査のみ)。
  if new.identity_status is distinct from old.identity_status
     and new.identity_status not in ('pending', 'unsubmitted') then
    new.identity_status := old.identity_status;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns_trg on public.profiles;
create trigger protect_profile_privileged_columns_trg
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- 確認(任意): 一般ユーザーで update profiles set fee_rate=0 / identity_status='approved'
--             を実行しても値が変わらなければOK。
