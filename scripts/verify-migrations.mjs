// 読み取り専用：v12/v13/v14 マイグレーションが本番DBに適用されたか確認
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function check(label, fn) {
  const { error } = await fn()
  if (error) console.log(`✗ ${label}\n    → ${error.message}`)
  else console.log(`✓ ${label}`)
}

console.log('=== v12: profiles 補填カラム ===')
await check('profiles.is_suspended / birthday_public / signup_invite_code 等',
  () => admin.from('profiles').select('id, is_suspended, suspended_reason, suspended_at, birthday_public, accepts_birthday_messages, signup_invite_code').limit(1))

console.log('\n=== v13: ブロック機能 ===')
await check('creator_blocks テーブル',
  () => admin.from('creator_blocks').select('id, creator_id, blocked_user_id, reason, created_at').limit(1))

console.log('\n=== v14: アンケート機能 ===')
await check('polls テーブル',
  () => admin.from('polls').select('id, creator_id, question, options, status, created_at').limit(1))
await check('poll_votes テーブル',
  () => admin.from('poll_votes').select('id, poll_id, user_id, option_index, created_at').limit(1))

console.log('\n完了')
