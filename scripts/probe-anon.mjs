// 読み取り専用：anonロール（ブラウザ相当）で各テーブルにアクセスできるか確認
//   200/空配列=露出OK（RLSで0件はOK）, 401/404/権限エラー=露出漏れ（実バグ）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const TABLES = [
  'notifications','tips','deliveries','contact_messages','identity_documents','admin_actions',
  'invite_codes','invite_redemptions','stories','story_views','live_streams','live_chat_messages',
  'subscriptions','subscription_plans','request_auctions','auction_bids',
  'content_comments','comment_likes','comment_reports','birthday_messages',
]

for (const t of TABLES) {
  const { error } = await anon.from(t).select('*', { head: true }).limit(1)
  if (!error) { console.log(`OK    ${t}`); continue }
  const code = error.code ?? ''
  const flag = /does not exist|schema cache|PGRST205|42P01/i.test(error.message + code) ? '❌露出漏れ'
            : /permission denied|42501/i.test(error.message + code) ? '⚠️権限なし'
            : 'RLS/他'
  console.log(`${flag}  ${t}: [${code}] ${error.message}`)
}
