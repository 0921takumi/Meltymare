-- ============================================================
-- v50: 本人確認の証拠書類(identity_document_url/identity_selfie_url)・
--      生年月日(birthdate)を、正当な(再)提出以外での書き換えから保護する
--
-- 発見した脆弱性(全体検証で発覚):
--   v26 の protect_profile_privileged_columns トリガーは role/fee_rate/is_suspended等の
--   特権列と identity_status の遷移は保護していたが、identity_document_url/
--   identity_selfie_url/birthdate の3列は一切保護しておらず、承認済み(approved)の
--   アカウントでもこれらを黙って書き換えられた。identity_status 自体を
--   'approved'から動かせない(v26で保護済み)ため承認は維持されたままだが、
--   運営が確認したはずの本人確認書類・生年月日だけを事後に差し替えられる、
--   という監査証跡・KYCの整合性の穴になっていた。
--
-- 方針: この3列が変わってよいのは「このUPDATEでidentity_statusを'pending'に
--   する(=正当な提出/再提出)」場合のみ。それ以外の変更は旧値に戻す。
--   v26のidentity_status遷移チェックの「後」に評価することで、
--   'approved'→'pending'のような不正遷移が既に無効化された最終状態を見て判定する。
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

  -- v50: 証拠書類・生年月日は「このUPDATEで最終的にidentity_status='pending'
  -- になる(=正当な提出/再提出)」場合以外は変更させない。上のブロックで
  -- 不正な遷移は既に無効化済みなので、ここでは new.identity_status
  -- (調整後の最終値)だけを見ればよい。
  if new.identity_status is distinct from 'pending' then
    new.identity_document_url := old.identity_document_url;
    new.identity_selfie_url   := old.identity_selfie_url;
    new.birthdate             := old.birthdate;
  end if;

  return new;
end;
$$;

-- 確認(必須):
--   1. 通常の提出フロー: identity_document_url/identity_selfie_url/birthdate と
--      identity_status='pending' を同時にUPDATEすると、全て新しい値に変わること。
--   2. 攻撃シナリオ: identity_status='approved'のアカウントが、identity_statusは
--      触らずidentity_document_urlだけをUPDATEしても、値が旧値のまま変わらないこと。
-- ============================================================
