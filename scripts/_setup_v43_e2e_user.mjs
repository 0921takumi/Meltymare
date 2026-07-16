import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const email = 'qa.v43.e2e@my-focus.jp'
const password = 'QaV43E2e!2026'
const { data: ex } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
if (ex) await admin.auth.admin.deleteUser(ex.id).catch(() => {})
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
await new Promise(r => setTimeout(r, 1000))
await admin.from('profiles').upsert({ id: created.user.id, email, username: 'qa_v43_e2e', display_name: 'QA E2E', role: 'user' })
console.log('created uid:', created.user.id, 'email:', email, 'password:', password)
