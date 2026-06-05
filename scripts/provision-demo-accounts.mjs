// 既存の3テストアカウント（@meltymare.com）を My Focus デモ用にリブランド。
//   - auth: メールを my-focus.jp に変更 / 既知パスワード設定 / email_confirm
//   - profiles: email・表示名を更新、creator は identity_status=approved
// 新規アカウントは作らない。削除もしない。冪等（再実行可）。
// 使い方: node scripts/provision-demo-accounts.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 共通デモパスワード（クライアント共有用・10文字以上）
const DEMO_PW = 'MyFocusDemo2026!'

// 操作対象（旧メール → 新メール / 役割 / プロフィール更新）
const TARGETS = [
  {
    oldEmails: ['creator@meltymare.com', 'creator.demo@my-focus.jp'],
    newEmail: 'creator.demo@my-focus.jp',
    profile: {
      email: 'creator.demo@my-focus.jp',
      display_name: 'モモ',
      username: 'momo_demo',
      identity_status: 'approved',
      bio: '☕ コンセプトカフェ店員｜チェキ・お手紙・限定動画をお届け｜デモアカウント',
    },
  },
  {
    oldEmails: ['user@meltymare.com', 'fan.demo@my-focus.jp'],
    newEmail: 'fan.demo@my-focus.jp',
    profile: { email: 'fan.demo@my-focus.jp', display_name: 'デモファン', username: 'fan_demo' },
  },
  {
    oldEmails: ['admin@meltymare.com', 'admin.demo@my-focus.jp'],
    newEmail: 'admin.demo@my-focus.jp',
    profile: { email: 'admin.demo@my-focus.jp', display_name: 'My Focus 運営（デモ）', username: 'myfocus_admin' },
  },
]

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) { console.error('listUsers error:', listErr.message); process.exit(1) }

const results = []
for (const t of TARGETS) {
  const u = list.users.find(x => t.oldEmails.includes(x.email))
  if (!u) { console.log(`SKIP: ${t.oldEmails[0]} が見つかりません`); continue }

  // 1) auth 更新：メール変更 + パスワード設定 + 確認済み化
  const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
    email: t.newEmail,
    password: DEMO_PW,
    email_confirm: true,
    user_metadata: { ...(u.user_metadata ?? {}), display_name: t.profile.display_name },
  })
  if (upErr) { console.error(`AUTH更新失敗 ${t.newEmail}:`, upErr.message); continue }

  // 2) profiles 更新
  const { error: pErr } = await admin.from('profiles').update(t.profile).eq('id', u.id)
  if (pErr) console.error(`PROFILE更新失敗 ${t.newEmail}:`, pErr.message)

  results.push({ email: t.newEmail, id: u.id.slice(0, 8) })
  console.log(`OK: ${u.email} → ${t.newEmail} (profile更新済)`)
}

console.log('\n========== デモログイン情報 ==========')
console.log(`パスワード（共通）: ${DEMO_PW}`)
for (const r of results) console.log(`  ${r.email}`)
console.log('=====================================')
