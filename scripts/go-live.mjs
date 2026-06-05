// Stripe 本番化を一括実行（キー/シークレットは一切printしない）
//   1. メモから sk_live_ を取得・検証
//   2. 本番Webhookを作成（既存同URLは削除）
//   3. Vercel本番env に STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET を設定（stdin経由）
//   4. 本番再デプロイ
//   5. 本番Webhookの署名検証（合成イベント・DB無変更）
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import Stripe from 'stripe'

const MEMO = '_STRIPE本番キー_ここに貼る.txt'
const WEBHOOK_URL = 'https://my-focus-neon.vercel.app/api/webhook'
const EVENTS = ['checkout.session.completed', 'charge.refunded']

// 1) メモから sk_live_ 抽出
const memo = readFileSync(new URL(`../${MEMO}`, import.meta.url), 'utf8')
const m = memo.match(/sk_live_[A-Za-z0-9]+/)
if (!m) { console.error('NG: メモに sk_live_ が見つかりません'); process.exit(1) }
const LIVE_KEY = m[0]
console.log(`本番キー検出: sk_live_…${LIVE_KEY.slice(-4)}（以降マスク）`)

const stripe = new Stripe(LIVE_KEY)

// 2) アカウント検証
const acct = await stripe.accounts.retrieve()
console.log(`\n=== アカウント ===`)
console.log(`id: ${acct.id} / charges_enabled: ${acct.charges_enabled} / payouts_enabled: ${acct.payouts_enabled}`)
try {
  const ext = await stripe.accounts.listExternalAccounts(acct.id, { object: 'bank_account', limit: 3 })
  console.log(`登録口座: ${ext.data.length}件 — ${ext.data.map(b => `${b.bank_name ?? '?'}/***${b.last4}/${b.status}`).join(', ') || 'なし'}`)
} catch (e) { console.log(`(口座取得スキップ: ${e.message})`) }

// 3) 本番Webhook作成（既存同URL削除）
const list = await stripe.webhookEndpoints.list({ limit: 100 })
for (const e of list.data) if (e.url === WEBHOOK_URL) { await stripe.webhookEndpoints.del(e.id); console.log(`\n既存webhook削除: ${e.id}`) }
const wh = await stripe.webhookEndpoints.create({ url: WEBHOOK_URL, enabled_events: EVENTS, description: 'My Focus 本番(LIVE) — 購入完了/返金' })
const WHSEC = wh.secret
console.log(`本番webhook作成: ${wh.id} [${wh.enabled_events.join(', ')}]`)

// 4) Vercel本番env 設定（値は stdin 経由・argvに出さない）
function setEnv(name, value) {
  spawnSync(`vercel env rm ${name} production --yes`, { shell: true, stdio: 'ignore' })
  const r = spawnSync(`vercel env add ${name} production`, { shell: true, input: value, encoding: 'utf8' })
  console.log(`env ${name}: ${r.status === 0 ? 'OK' : 'FAILED ' + (r.stderr ?? '')}`)
}
console.log(`\n=== Vercel本番env 設定 ===`)
setEnv('STRIPE_SECRET_KEY', LIVE_KEY)
setEnv('STRIPE_WEBHOOK_SECRET', WHSEC)

// 5) 本番再デプロイ
console.log(`\n=== 本番再デプロイ ===`)
const dep = spawnSync('vercel deploy --prod --yes', { shell: true, encoding: 'utf8', timeout: 180000 })
const depUrl = (dep.stdout ?? '').match(/https:\/\/[a-z0-9-]+\.vercel\.app/g)?.pop()
console.log(`deploy status: ${dep.status === 0 ? 'OK' : 'FAILED'} ${depUrl ?? ''}`)
if (dep.status !== 0) console.log((dep.stderr ?? '').slice(-300))

// 6) 署名検証（合成イベント・存在しないsession → DB無変更で200想定）
const payload = JSON.stringify({
  id: 'evt_live_verify', object: 'event', type: 'checkout.session.completed',
  data: { object: { id: 'cs_live_NONEXISTENT_VERIFY', object: 'checkout.session', payment_intent: null, metadata: {} } },
})
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC })
const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': header }, body: payload })
console.log(`\n署名検証: HTTP ${res.status} ${res.status === 200 ? '✓ 本番Webhook配線OK' : '✗ 要確認'}`)
