// 本番Webhookの署名検証が通るかを確認（DBは変化しない：存在しないsession_id）
//   同じ whsec で署名 → 200 が返れば「Stripe登録シークレット = 本番デプロイのシークレット」が一致。
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const WHSEC = 'whsec_7vekSbVshighvcz77nN8uchDa5UKuMLi'
const WEBHOOK_URL = 'https://my-focus-neon.vercel.app/api/webhook'

// 合成イベント（存在しないsession → ハンドラは "no purchase" で早期return、200）
const payload = JSON.stringify({
  id: 'evt_test_verify',
  object: 'event',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_test_NONEXISTENT_VERIFY', object: 'checkout.session', payment_intent: null, metadata: {} } },
})

const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC })

const res = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  body: payload,
})
const text = await res.text()
console.log(`HTTP ${res.status}`)
console.log(`body: ${text}`)
console.log(res.status === 200 ? '\n✓ 署名検証OK — 本番Webhook配線完了' : '\n✗ NG — シークレット不一致 or ルート未デプロイ')
