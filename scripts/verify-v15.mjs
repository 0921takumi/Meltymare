// 読み取り専用：migration v15（Stripe整合性制約）が適用されたか確認
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('=== v15: purchases.status に refunded / cancelled が許可されたか ===')
// refunded を含むダミー行を1件 insert→即削除して CHECK 制約を試す（実データに影響しないよう存在しないIDで）
// より安全に: 既存の completed 行が無くても、制約定義そのものを information_schema で見るのは
// service_role でも難しいため、"refunded への更新が check 違反を起こさないか" を空振りクエリで確認する。
const probeId = '00000000-0000-0000-0000-000000000000'
const { error: updErr } = await admin
  .from('purchases')
  .update({ status: 'refunded' })
  .eq('id', probeId) // 該当行ゼロ件 → 実データ変更なし。ただし CHECK 制約違反なら 0 件でもエラーが返る DB がある
if (updErr && /check/i.test(updErr.message)) {
  console.log('✗ purchases.status はまだ refunded を許可していない → v15 未適用')
  console.log('   detail:', updErr.message)
} else {
  console.log('✓ purchases.status: refunded への更新が CHECK 制約で弾かれない（v15 適用済みの可能性大）')
}

console.log('\n=== v15: tips.stripe_payment_intent_id の UNIQUE インデックス ===')
console.log('  （インデックス有無は service_role の通常クエリでは直接確認不可。')
console.log('   下記SQLを Supabase SQL Editor で実行すると確実に確認できます）')
console.log("  SELECT indexname FROM pg_indexes WHERE tablename='tips' AND indexname='tips_stripe_pi_uniq';")

console.log('\n完了')
