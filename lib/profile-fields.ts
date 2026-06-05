/**
 * profiles テーブルの「公開してよい列」の単一の真実（single source of truth）。
 *
 * 背景（個情法ブロッカー / v22）:
 *   profiles の RLS は長らく `using (true)` で、列権限も未整備だった。その結果
 *   anon（ブラウザ公開鍵）で email / 銀行口座 / 生年月日 / 本人確認書類URL 等の
 *   PII を PostgREST 直叩きで読めてしまっていた。
 *
 *   v22 マイグレーションで `REVOKE SELECT ON profiles FROM anon, authenticated` し、
 *   ここに列挙した「公開列だけ」を GRANT し直す。これにより:
 *     - `select('*')` は REVOKE 済み列を含むため anon/authenticated では 42501 で失敗する
 *       → 必ずこの定数で「明示的に公開列だけ」を select する必要がある。
 *     - 本人が自分の PII（email / 銀行 / 本人確認）を見る画面は service_role 経由の
 *       `/api/me` で取得する（[[app/api/me]]）。
 *     - 他人の PII を正当に読む管理画面・誕生日機能は service_role クライアント
 *       （lib/supabase/admin.ts）で読む。
 *
 * ⚠️ この配列に列を足すと anon に晒される。PII（下記 PROFILE_PII_COLUMNS）は
 *    絶対に足さないこと。変更時は v22 SQL の GRANT 列と必ず一致させる。
 */
export const PROFILE_PUBLIC_COLUMNS = [
  'id',
  'username',
  'display_name',
  'avatar_url',
  'bio',
  'role',
  'created_at',
  'twitter_url',
  'instagram_url',
  'tiktok_url',
  'fee_rate',
  'identity_status',
] as const

/**
 * PostgREST の `.select()` にそのまま渡せるカンマ区切り文字列。
 * 使い方: `supabase.from('profiles').select(PROFILE_PUBLIC_SELECT)`
 *
 * ⚠️ あえて「文字列リテラル」で定義している（`.join()` で組み立てない）。
 *    supabase-js の `.select()` は **文字列リテラル型** のときだけ行の型を推論できる。
 *    `string` 型（join の戻り値）を渡すと推論が外れて GenericStringError になり、
 *    呼び出し側で `profile.role` 等が型エラーになる。PROFILE_PUBLIC_COLUMNS と
 *    並び・内容を必ず一致させること（下の assert で軽く担保）。
 */
export const PROFILE_PUBLIC_SELECT =
  'id, username, display_name, avatar_url, bio, role, created_at, twitter_url, instagram_url, tiktok_url, fee_rate, identity_status' as const

// PROFILE_PUBLIC_SELECT が PROFILE_PUBLIC_COLUMNS と一致していることの軽い担保。
// 取り違え検知用。本番では評価しない（開発/テスト時のみ）。
if (process.env.NODE_ENV !== 'production' && PROFILE_PUBLIC_SELECT !== PROFILE_PUBLIC_COLUMNS.join(', ')) {
  throw new Error('PROFILE_PUBLIC_SELECT が PROFILE_PUBLIC_COLUMNS と一致していません')
}

/**
 * 公開プロフィールの型。`select('*')` の `any` 運用をやめ、公開列だけ持つ型に寄せる。
 * Header など UI が必要とするのはこの形のサブセット。
 */
export interface PublicProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  role: 'user' | 'creator' | 'admin'
  created_at: string
  twitter_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  fee_rate: number
  identity_status: 'unsubmitted' | 'pending' | 'approved' | 'rejected'
}

/**
 * 公開してはいけない PII 列の一覧（ドキュメント兼テスト用の参照）。
 * v22 では anon/authenticated に GRANT しない。service_role のみ読める。
 * 値の更新（本人による自己更新）は RLS の profiles_update_self で別途許可される。
 */
export const PROFILE_PII_COLUMNS = [
  'email',
  'bank_name',
  'bank_branch',
  'bank_account_type',
  'bank_account_number',
  'bank_account_holder',
  'birthdate',
  'identity_document_url',
  'identity_selfie_url',
  'identity_rejection_reason',
  'identity_submitted_at',
  'identity_reviewed_at',
  'suspended_reason',
  'suspended_at',
  'is_suspended',
  'birthday_public',
  'accepts_birthday_messages',
  'signup_invite_code',
] as const
