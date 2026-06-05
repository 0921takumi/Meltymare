// 読み取り専用：コンテンツの所有者とプロフィール詳細を確認
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// profiles 全カラム確認（1行サンプル）
const { data: sample } = await admin.from('profiles').select('*').limit(1)
console.log('profiles カラム:', sample?.[0] ? Object.keys(sample[0]).join(', ') : '(none)')
console.log('')

const { data: profs } = await admin.from('profiles').select('id, email, role, username, display_name, identity_status')
console.log('--- profiles ---')
for (const p of profs ?? []) console.log(`  ${p.role} | ${p.email} | @${p.username} | ${p.display_name} | identity=${p.identity_status}`)
console.log('')

// contents 件数 + 所有者
const { data: contents } = await admin.from('contents').select('id, creator_id, title, price, is_published, sold_count')
console.log(`--- contents: ${contents?.length ?? 0} 件 ---`)
const byCreator = {}
for (const c of contents ?? []) byCreator[c.creator_id] = (byCreator[c.creator_id] ?? 0) + 1
for (const [cid, n] of Object.entries(byCreator)) {
  const owner = profs?.find(p => p.id === cid)
  console.log(`  creator_id ${cid.slice(0,8)}… (${owner?.display_name ?? '?'}): ${n} 件`)
}
if (contents?.length) {
  console.log('  例:')
  for (const c of contents.slice(0, 5)) console.log(`    - ${c.title} | ¥${c.price} | published=${c.is_published} | sold=${c.sold_count}`)
}
