import { createClient } from '@supabase/supabase-js'

/**
 * service_role（RLS バイパス）Supabase クライアント。
 *
 * ⚠️ サーバー専用。SUPABASE_SERVICE_ROLE_KEY（非 NEXT_PUBLIC_）を読むため、
 *    クライアントバンドルでは serviceKey が undefined になり throw する。
 *    既存の各 API ルートが inline で行っていた createAdminClient をここに集約する。
 *    絶対に 'use client' 側へ import しないこと。
 *
 * v22 で profiles の PII 列を anon/authenticated から REVOKE したため、
 *   - 本人が自分の PII を読む（/api/me）
 *   - 管理者が他人の PII を読む（/admin/*、認可は app/admin/layout.tsx が担保）
 *   - 誕生日機能が opt-in 済みユーザーの birthdate を読む（年は捨てて公開）
 * といった「正当な PII 読み取り」はこのクライアント経由で行う。
 *
 * 認可（誰がこれを使ってよいか）は呼び出し側の責任。このクライアント自体は
 * 一切の権限チェックをしない。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
