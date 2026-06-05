// 読み取り専用：コードが参照する全テーブルの実在を確認
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// コードで .from() 参照されている全テーブル（storageバケット候補も含む）
const TABLES = [
  'profiles','contents','purchases','coupons','follows','requests','reviews','payouts',
  'featured_banners','inquiries','audit_logs','profiles_public',
  // 存在が疑わしいもの
  'notifications','tips','deliveries','contact_messages','identity_documents','admin_actions',
  'invite_codes','invite_redemptions','stories','story_views','live_streams','live_chat_messages',
  'subscriptions','subscription_plans','request_auctions','auction_bids',
  'content_comments','comment_likes','comment_reports','birthday_messages',
]

const exist = [], missing = []
for (const t of TABLES) {
  const { error } = await admin.from(t).select('*', { head: true, count: 'exact' }).limit(1)
  if (error && /does not exist|could not find|schema cache/i.test(error.message)) missing.push(t)
  else if (error) { console.log(`? ${t}: ${error.message}`); exist.push(t) }
  else exist.push(t)
}
console.log(`\n=== 実在 (${exist.length}) ===`)
console.log(exist.join(', '))
console.log(`\n=== 存在しない (${missing.length}) ===`)
console.log(missing.join(', '))
