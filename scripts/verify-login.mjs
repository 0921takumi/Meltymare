// 読み取り専用：クライアントと同じ方法（anon key + signInWithPassword）でログイン検証
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const DEMO_PW = 'MyFocusDemo2026!'
const emails = ['creator.demo@my-focus.jp', 'fan.demo@my-focus.jp', 'admin.demo@my-focus.jp']

for (const email of emails) {
  // 毎回新しいクライアント（セッション混在を避ける）
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password: DEMO_PW })
  if (error) { console.log(`NG  ${email}: ${error.message}`); continue }
  // ログイン後にprofile/roleを取得
  const { data: prof } = await sb.from('profiles').select('role, display_name, identity_status').eq('id', data.user.id).single()
  console.log(`OK  ${email} | role=${prof?.role} | ${prof?.display_name} | identity=${prof?.identity_status}`)
  await sb.auth.signOut()
}
