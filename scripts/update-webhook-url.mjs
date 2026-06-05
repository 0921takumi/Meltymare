/**
 * Stripe Webhook URL を my-focus-neon.vercel.app → my-focus.jp に更新する
 *
 * 使い方:
 *   1. _stripe_secret_ここに貼る.txt を作成して sk_live_... を貼る
 *   2. node scripts/update-webhook-url.mjs
 *   3. 完了後ファイルは自動削除される
 *
 * 実行タイミング: my-focus.jp の DNS が伝播して HTTPS 疎通確認後
 */
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import Stripe from 'stripe'

const MEMO = '_stripe_secret_ここに貼る.txt'
const OLD_URL = 'https://my-focus-neon.vercel.app/api/webhook'
const NEW_URL = 'https://my-focus.jp/api/webhook'
const EVENTS = ['checkout.session.completed', 'charge.refunded']

const memoPath = new URL(`../${MEMO}`, import.meta.url)
if (!existsSync(memoPath)) {
  console.error(`✗ ${MEMO} が見つかりません。sk_live_... を書いて再実行してください。`)
  process.exit(1)
}
const key = readFileSync(memoPath, 'utf8').trim()
if (!key.startsWith('sk_live_')) {
  console.error('✗ ライブキー（sk_live_）を貼ってください')
  process.exit(1)
}
const stripe = new Stripe(key, { apiVersion: '2024-04-10' })

// 疎通確認
console.log('1) my-focus.jp の HTTPS 疎通確認...')
try {
  const res = await fetch(NEW_URL.replace('/api/webhook', '/'))
  if (!res.ok && res.status !== 307 && res.status !== 200) {
    console.warn(`  ⚠ ${NEW_URL} → HTTP ${res.status} — DNS未伝播の可能性あり（続行）`)
  } else {
    console.log(`  ✓ HTTP ${res.status}`)
  }
} catch (e) {
  console.error(`  ✗ 接続失敗: ${e.message}\n  DNS が伝播するまで待ってから再実行してください`)
  process.exit(1)
}

// 既存webhookを検索
console.log('2) 既存 webhook 一覧取得...')
const list = await stripe.webhookEndpoints.list({ limit: 100 })
let oldId = null
for (const e of list.data) {
  console.log(`  ${e.id}  ${e.url}  [${e.status}]`)
  if (e.url === OLD_URL) oldId = e.id
  if (e.url === NEW_URL) {
    console.log('  → 既に my-focus.jp webhook が存在します。更新不要。')
    unlinkSync(memoPath)
    process.exit(0)
  }
}

// 旧 webhook 削除
if (oldId) {
  await stripe.webhookEndpoints.del(oldId)
  console.log(`  削除: ${oldId} (${OLD_URL})`)
}

// 新 webhook 作成
console.log('3) my-focus.jp webhook 作成...')
const wh = await stripe.webhookEndpoints.create({
  url: NEW_URL,
  enabled_events: EVENTS,
  description: 'My Focus 本番(LIVE) — 購入完了/返金',
})
console.log(`  ✓ 作成: ${wh.id}`)
const secret = wh.secret
console.log(`  STRIPE_WEBHOOK_SECRET (新): ${secret.slice(0, 12)}...`)

// Vercel env 更新
console.log('4) Vercel env STRIPE_WEBHOOK_SECRET 更新...')
const { execSync } = await import('node:child_process')
execSync(`echo "${secret}" | npx vercel env add STRIPE_WEBHOOK_SECRET production --force`, { stdio: 'inherit' })

// 再デプロイ
console.log('5) 本番デプロイ（env反映）...')
execSync('npx vercel deploy --prod --yes', { stdio: 'inherit' })

// メモ削除
unlinkSync(memoPath)
console.log(`\n✓ ${MEMO} 削除済み`)

// 署名検証
console.log('6) 署名検証テスト...')
const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object: { id: 'cs_test' } } })
const header = stripe.webhooks.generateTestHeaderString({ payload, secret })
const res2 = await fetch(NEW_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  body: payload,
})
console.log(`  署名検証: HTTP ${res2.status} ${res2.status === 200 ? '✓ OK' : '✗ 要確認'}`)

console.log('\n=== 完了 ===')
console.log(`Stripe webhook: ${NEW_URL}`)
