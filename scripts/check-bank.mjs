// 読み取り専用：銀行口座がDBに保存されたか確認（機密はマスク表示）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data, error } = await admin
  .from('profiles')
  .select('email, role, bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_holder')
if (error) { console.error(error.message); process.exit(1) }

const mask = v => v ? `***${String(v).slice(-4)}` : '(未登録)'
const has = v => v ? 'あり' : '(未登録)'

for (const p of data) {
  const registered = p.bank_name || p.bank_account_number
  console.log(`${p.email} [${p.role}]`)
  if (registered) {
    console.log(`   銀行: ${p.bank_name ?? '?'} ${p.bank_branch ?? ''} / 種別: ${p.bank_account_type ?? '?'}`)
    console.log(`   口座番号: ${mask(p.bank_account_number)} / 名義: ${has(p.bank_account_holder)}`)
  } else {
    console.log('   口座: 未登録')
  }
}
