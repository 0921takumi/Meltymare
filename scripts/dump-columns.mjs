// 読み取り専用：全テーブルの実カラムを取得（行があればkeyから、空ならOpenAPI補完）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key, { auth: { persistSession: false } })

const TABLES = ['profiles','contents','purchases','coupons','follows','requests','reviews','payouts',
  'featured_banners','inquiries','audit_logs','notifications','tips','deliveries','contact_messages',
  'identity_documents','admin_actions','invite_codes','invite_redemptions','stories','story_views',
  'live_streams','live_chat_messages','subscriptions','subscription_plans','request_auctions',
  'auction_bids','content_comments','comment_likes','comment_reports','birthday_messages']

// OpenAPI で取れる定義
let defs = {}
try {
  const spec = await (await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json()
  defs = spec.definitions ?? {}
} catch {}

const out = {}
for (const t of TABLES) {
  // 1行取得してkeyを得る（最も確実）
  const { data } = await admin.from(t).select('*').limit(1)
  if (data && data.length) out[t] = Object.keys(data[0])
  else if (defs[t]?.properties) out[t] = Object.keys(defs[t].properties)
  else out[t] = ['(空テーブル・列不明)']
}
for (const t of TABLES) console.log(`【${t}】 ${out[t].join(', ')}`)
