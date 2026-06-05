// 読み取り専用：本番Supabaseの認証ユーザー / プロフィール状態を診断する
// 使い方: node scripts/diagnose-auth.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// .env.local を手動パース（秘匿値はログに出さない）
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) { console.error('missing env'); process.exit(1) }

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

console.log('=== Supabase project:', url, '===\n')

// 1) auth.users の一覧（メール / 確認済みか / 作成日）
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) { console.error('listUsers error:', listErr.message) }
else {
  console.log(`auth.users 件数: ${list.users.length}`)
  for (const u of list.users) {
    console.log(`  - ${u.email ?? '(no email)'} | confirmed=${!!u.email_confirmed_at} | provider=${u.app_metadata?.provider ?? '?'} | id=${u.id.slice(0,8)}…`)
  }
}

console.log('')

// 2) profiles の role 別カウント
const { data: profs, error: pErr } = await admin.from('profiles').select('id, email, role, username, display_name')
if (pErr) { console.error('profiles error:', pErr.message) }
else {
  const byRole = {}
  for (const p of profs) byRole[p.role ?? 'null'] = (byRole[p.role ?? 'null'] ?? 0) + 1
  console.log('profiles role別:', JSON.stringify(byRole))
  console.log('profiles 総数:', profs.length)
}

console.log('')

// 3) auth.users と profiles の突合（ログイン可能なcreatorが居るか）
if (list && profs) {
  const authIds = new Set(list.users.map(u => u.id))
  const loginableCreators = profs.filter(p => p.role === 'creator' && authIds.has(p.id))
  const loginableUsers = profs.filter(p => p.role === 'user' && authIds.has(p.id))
  console.log(`ログイン可能な creator: ${loginableCreators.length} 件`)
  for (const c of loginableCreators) console.log(`    ${c.email ?? c.username} (${c.display_name})`)
  console.log(`ログイン可能な user(ファン): ${loginableUsers.length} 件`)
}
