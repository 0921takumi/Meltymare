-- ============================================================
-- MyFocus Migration v17 — 招待コード redemption の atomic 化
--
-- 背景:
--   /api/invite/redeem が used_count を「SELECT → +1 → UPDATE」の3ステップで
--   更新していたため、並列リクエストで lost update が発生し max_uses を超過する。
--   さらに、認証なしで任意の user_id で redemption が作れる致命的な穴があった。
--
-- 対策:
--   1. CAS 化された RPC を提供（max_uses 未到達かつ is_active かつ未期限のときのみ +1）
--   2. SECURITY DEFINER で実行し、actor を auth.uid() に固定 → API 側で
--      user_id をクライアントから受け取らない設計に統一する
--
-- 冪等（create or replace）なので再実行 OK。
-- ============================================================

create or replace function public.redeem_invite_code(p_invite_code_id uuid)
returns boolean as $$
declare
  rows_affected int;
  actor uuid := auth.uid();
begin
  -- 認証必須。サーバー側で auth.uid() が取れない場合は弾く。
  if actor is null then
    return false;
  end if;

  -- CAS: 同時に「上限未到達」「is_active」「未期限」を満たす場合のみ +1
  update public.invite_codes
    set used_count = coalesce(used_count, 0) + 1
    where id = p_invite_code_id
      and is_active = true
      and (max_uses is null or coalesce(used_count, 0) < max_uses)
      and (expires_at is null or expires_at > now());

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    return false;
  end if;

  -- redemption 履歴を残す（user_id はクライアント入力ではなく auth.uid()）
  insert into public.invite_redemptions (invite_code_id, user_id)
    values (p_invite_code_id, actor)
    on conflict do nothing;

  return true;
end;
$$ language plpgsql security definer;

grant execute on function public.redeem_invite_code(uuid) to authenticated, service_role;

-- ============================================================
-- 運用メモ:
--   invite_redemptions テーブルに (invite_code_id, user_id) のユニーク制約を
--   貼ることを推奨（同一ユーザーの二重 redemption 防止）。
--
--     create unique index if not exists invite_redemptions_unique
--       on public.invite_redemptions(invite_code_id, user_id);
--
--   既存環境にユニーク制約が無い場合は別途追加する。
-- ============================================================

create unique index if not exists invite_redemptions_unique
  on public.invite_redemptions(invite_code_id, user_id);
