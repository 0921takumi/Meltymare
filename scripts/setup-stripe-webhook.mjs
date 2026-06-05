// Stripe Webhook エンドポイントを API 経由で作成（テストモード）。
//   作成時のみ署名シークレット(whsec_)が返るので、既存の同URLは削除して作り直す。
// 使い方: node scripts/setup-stripe-webhook.mjs
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const URL_TARGET = 'https://my-focus-neon.vercel.app/api/webhook'
const EVENTS = ['checkout.session.completed', 'charge.refunded']

const mode = env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'
console.log(`Stripe mode: ${mode}`)
console.log(`Target URL : ${URL_TARGET}\n`)

// 既存の同URLエンドポイントを削除（冪等＆新しいsecret取得のため）
const existing = await stripe.webhookEndpoints.list({ limit: 100 })
for (const e of existing.data) {
  if (e.url === URL_TARGET) {
    await stripe.webhookEndpoints.del(e.id)
    console.log(`既存エンドポイント削除: ${e.id}`)
  }
}

// 新規作成
const endpoint = await stripe.webhookEndpoints.create({
  url: URL_TARGET,
  enabled_events: EVENTS,
  description: 'My Focus 本番(テストモード) — 購入完了/返金',
})

console.log(`\n作成完了: ${endpoint.id}`)
console.log(`イベント: ${endpoint.enabled_events.join(', ')}`)
console.log('\n========== STRIPE_WEBHOOK_SECRET ==========')
console.log(endpoint.secret)
console.log('===========================================')
