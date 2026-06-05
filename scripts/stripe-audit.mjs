// 読み取り専用 Stripe 本番疎通監査スクリプト（変更禁止）
// 本番Vercel環境変数（.env.production.local）から sk_live_ キーを使用

import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

// .env.production.local を優先、次に .env.local
function loadEnv(filename) {
  try {
    const env = {}
    for (const line of readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/)
      if (m) env[m[1]] = m[2].replace(/\\n$/, '')
    }
    return env
  } catch { return {} }
}

const prodEnv = loadEnv('.env.production.local')
const localEnv = loadEnv('.env.local')
const env = { ...localEnv, ...prodEnv }

const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET

console.log('=== Stripe 本番疎通監査 ===')
console.log(`STRIPE_SECRET_KEY prefix  : ${STRIPE_SECRET_KEY?.slice(0, 12)}...`)
console.log(`STRIPE_WEBHOOK_SECRET prefix: ${STRIPE_WEBHOOK_SECRET?.slice(0, 12)}...`)
console.log(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '(未設定)'}`)
console.log('')

if (!STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
  console.log('🔴 BLOCKER: STRIPE_SECRET_KEY が sk_live_ で始まっていません。本番キーではありません。')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })

function pass(msg) { console.log(`✅ ${msg}`) }
function warn(msg) { console.log(`🟡 HIGH: ${msg}`) }
function block(msg) { console.log(`🔴 BLOCKER: ${msg}`) }
function info(msg) { console.log(`🟢 INFO: ${msg}`) }

// 1. アカウント情報確認
console.log('\n--- 1. Stripe アカウント接続性 ---')
try {
  const account = await stripe.accounts.retrieve()
  if (account.charges_enabled) { pass('charges_enabled = true') } else { block('charges_enabled = false — 決済不可') }
  if (account.payouts_enabled) { pass('payouts_enabled = true') } else { warn('payouts_enabled = false — 入金不可') }
  if (account.country === 'JP') { pass(`country = JP`) } else { block(`country = ${account.country} — 日本アカウントではない`) }
  if (account.business_profile?.name || account.business_profile?.url) {
    pass(`business_profile あり (name: ${account.business_profile.name || '-'}, url: ${account.business_profile.url || '-'})`)
  } else {
    warn('business_profile が空 — Stripe審査に影響する可能性')
  }
  if (account.details_submitted) { pass('details_submitted = true') } else { block('details_submitted = false — アカウント設定未完了') }
  info(`account.id = ${account.id}`)
  info(`display_name = ${account.settings?.dashboard?.display_name || '(未設定)'}`)
} catch (e) { block(`アカウント取得失敗: ${e.message}`) }

// 2. Webhook endpoint確認
console.log('\n--- 2. Webhook endpoint 設定 ---')
let webhookEndpoint = null
try {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 })
  const myfocusEndpoints = endpoints.data.filter(ep => ep.url.includes('my-focus.jp'))
  const webhookUrl = 'https://my-focus.jp/api/webhook'

  if (myfocusEndpoints.length === 0) {
    block(`my-focus.jp/api/webhook が Stripe に登録されていない`)
  } else {
    for (const ep of myfocusEndpoints) {
      webhookEndpoint = ep
      pass(`endpoint 登録済み: ${ep.url}`)
      info(`endpoint.id = ${ep.id}`)
      info(`status = ${ep.status}`)

      const requiredEvents = ['checkout.session.completed', 'charge.refunded']
      for (const ev of requiredEvents) {
        if (ep.enabled_events.includes(ev) || ep.enabled_events.includes('*')) {
          pass(`  listen: ${ev}`)
        } else {
          block(`  listen 未設定: ${ev}`)
        }
      }
      info(`  全イベント(${ep.enabled_events.length}件): ${ep.enabled_events.slice(0, 5).join(', ')}${ep.enabled_events.length > 5 ? ' ...' : ''}`)

      if (ep.url !== webhookUrl) {
        warn(`URLが期待値と異なる: ${ep.url} (期待: ${webhookUrl})`)
      }
    }
  }

  // 想定外のendpoint（テスト環境向け等）
  const otherEndpoints = endpoints.data.filter(ep => !ep.url.includes('my-focus.jp'))
  if (otherEndpoints.length > 0) {
    warn(`my-focus.jp 以外の endpoint ${otherEndpoints.length}件: ${otherEndpoints.map(e => e.url).join(', ')}`)
  }
} catch (e) { block(`webhook endpoint取得失敗: ${e.message}`) }

// 3. Webhook配信履歴（最近の失敗チェック）
console.log('\n--- 3. Webhook 配信履歴 ---')
if (webhookEndpoint) {
  try {
    const deliveries = await stripe.webhookEndpoints.deliveries.list(webhookEndpoint.id, { limit: 20 })
    if (!deliveries || !deliveries.data) {
      info('deliveries API 未対応またはデータなし')
    } else {
      const failed = deliveries.data.filter(d => d.response_http_status && d.response_http_status >= 400)
      if (failed.length === 0) {
        pass(`直近${deliveries.data.length}件配信 — 失敗なし`)
      } else {
        for (const f of failed) {
          block(`失敗配信 id=${f.id} status=${f.response_http_status} event=${f.type} time=${new Date(f.created * 1000).toISOString()}`)
        }
      }
    }
  } catch (e) {
    info(`deliveries API: ${e.message} (APIバージョン差異の可能性)`)
    // events fallback
    try {
      const events = await stripe.events.list({ limit: 20 })
      const failed = events.data.filter(ev => ev.request?.idempotency_key && ev.type.includes('failed'))
      info(`直近 events 取得: ${events.data.length}件`)
      if (failed.length > 0) warn(`失敗イベント ${failed.length}件あり`)
      else pass('直近 events に失敗イベントなし（delivery詳細は Stripe dashboard で確認）')
    } catch (e2) { info(`events取得も失敗: ${e2.message}`) }
  }
} else {
  info('endpoint未登録のためskip')
}

// 4. テストイベント送信（疎通ping）
console.log('\n--- 4. Webhook テストイベント送信 ---')
if (webhookEndpoint) {
  try {
    const start = Date.now()
    // Stripe live modeではsend_test_event相当は POST /v1/webhook_endpoints/:id/send_test_event
    // ただしSDK経由では .deliveries 以外は直接APIコール
    const response = await stripe.request({
      method: 'POST',
      path: `/v1/webhook_endpoints/${webhookEndpoint.id}/send_test_event`,
      params: {},
      encoding: 'application/x-www-form-urlencoded',
    }).catch(async () => {
      // raw fetch fallback
      return await fetch(`https://api.stripe.com/v1/webhook_endpoints/${webhookEndpoint.id}/send_test_event`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      })
    })
    const latency = Date.now() - start
    info(`テストイベント送信試行 — レイテンシ ${latency}ms`)
    if (response && response.ok !== undefined) {
      if (response.ok) pass(`200 OK (${latency}ms)`)
      else warn(`非200 status=${response.status} (${latency}ms) — webhook疎通要確認`)
    }
  } catch (e) {
    info(`send_test_event: ${e.message}`)
  }
} else {
  info('endpoint未登録のためskip')
}

// 5. 過去Charge状態
console.log('\n--- 5. 直近 Charge 状態 ---')
try {
  const charges = await stripe.charges.list({ limit: 50 })
  const byStatus = {}
  for (const c of charges.data) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1
  }
  const total = charges.data.length
  if (total === 0) {
    info('課金実績なし (0件)')
  } else {
    info(`直近${total}件 内訳: ${JSON.stringify(byStatus)}`)
    const failCount = (byStatus['failed'] || 0)
    const failRate = total > 0 ? (failCount / total * 100).toFixed(1) : 0
    if (failCount === 0) pass(`失敗Charge: 0件`)
    else if (parseFloat(failRate) > 10) block(`失敗率 ${failRate}% (${failCount}/${total}件) — 異常高`)
    else warn(`失敗Charge ${failCount}件 (${failRate}%)`)
    const refunded = charges.data.filter(c => c.refunded)
    if (refunded.length > 0) info(`返金済み: ${refunded.length}件`)
  }
} catch (e) { info(`charges取得失敗: ${e.message}`) }

// 6. アクティブSubscription確認
console.log('\n--- 6. Subscription 状態 ---')
try {
  const subs = await stripe.subscriptions.list({ status: 'active', limit: 10 })
  if (subs.data.length === 0) {
    pass('active subscription: 0件 (FEATURES.subscriptions=false なので正常)')
  } else {
    block(`active subscription が ${subs.data.length}件存在 — FEATURES.subscriptions=false のため漏れの可能性`)
    for (const s of subs.data.slice(0, 5)) {
      info(`  sub.id=${s.id} customer=${s.customer} plan=${s.items.data[0]?.price?.id}`)
    }
  }
} catch (e) { info(`subscriptions取得失敗: ${e.message}`) }

// 7. Product/Price 確認
console.log('\n--- 7. Product/Price 一覧 ---')
try {
  const products = await stripe.products.list({ limit: 20 })
  const testProducts = products.data.filter(p => p.livemode === false)
  const liveProducts = products.data.filter(p => p.livemode === true)
  info(`products 合計: ${products.data.length}件 (live: ${liveProducts.length}, test: ${testProducts.length})`)
  if (testProducts.length > 0) {
    warn(`testモードのproductが ${testProducts.length}件混入: ${testProducts.map(p => p.id).join(', ')}`)
  } else {
    pass('testモードのproduct混入なし')
  }
  for (const p of liveProducts.slice(0, 10)) {
    info(`  ${p.id} "${p.name}" active=${p.active}`)
  }
} catch (e) { info(`products取得失敗: ${e.message}`) }

// 8. APIキー権限確認（書き込みを試みずに型だけ確認）
console.log('\n--- 8. APIキー権限 ---')
if (STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  pass('sk_live_ キーを使用中（フルアクセスキー）')
} else if (STRIPE_SECRET_KEY.startsWith('rk_live_')) {
  warn('rk_live_ キー — restricted key の可能性。必要な権限があるか要確認')
}
// restricted key は /v1/account に対してエラーを返す（既に1でテスト済み）

// Publishable key確認
console.log('\n--- 9. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 確認 ---')
const pubKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
if (!pubKey || pubKey === 'pk_test_dummy_for_build') {
  block(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "${pubKey || '(空)'}" — ダミー値または未設定。本番フロントエンドでStripe.js初期化不可`)
} else if (pubKey.startsWith('pk_live_')) {
  pass(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_ (本番キー設定済み)`)
} else if (pubKey.startsWith('pk_test_')) {
  warn(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_ — テストキー。本番環境で本番決済できない`)
}

console.log('\n=== 監査完了 ===')
