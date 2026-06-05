// 読み取り専用：purchases の状態を確認（pending で詰まっている購入がないか）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: purchases, error } = await admin
  .from('purchases')
  .select('id, user_id, content_id, status, amount, stripe_payment_intent_id, created_at')
  .order('created_at', { ascending: false })
if (error) { console.error(error.message); process.exit(1) }

const byStatus = {}
for (const p of purchases) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1
console.log(`purchases 総数: ${purchases.length}`)
console.log('status別:', JSON.stringify(byStatus), '\n')

// コンテンツ名引き当て
const { data: contents } = await admin.from('contents').select('id, title')
const titleOf = id => contents?.find(c => c.id === id)?.title ?? id.slice(0, 8)

for (const p of purchases.slice(0, 15)) {
  const pi = (p.stripe_payment_intent_id ?? '').slice(0, 14)
  console.log(`  [${p.status}] ${titleOf(p.content_id)} | ¥${p.amount} | ${pi}… | ${p.created_at?.slice(0,16)}`)
}
