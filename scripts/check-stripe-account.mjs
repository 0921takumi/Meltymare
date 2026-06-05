// 読み取り専用：Stripeアカウントの審査/入金状態を確認（口座番号はマスク）
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const mode = env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'
console.log(`APIキーのモード: ${mode}\n`)

const acct = await stripe.accounts.retrieve()
console.log('=== アカウント状態 ===')
console.log(`account id     : ${acct.id}`)
console.log(`country/currency: ${acct.country} / ${acct.default_currency}`)
console.log(`details_submitted: ${acct.details_submitted}  (申請情報の提出完了か)`)
console.log(`charges_enabled : ${acct.charges_enabled}  (本番で課金できるか)`)
console.log(`payouts_enabled : ${acct.payouts_enabled}  (入金=口座への振込ができるか)`)

const req = acct.requirements ?? {}
console.log('\n=== 残りの要対応（requirements）===')
console.log(`currently_due : ${JSON.stringify(req.currently_due ?? [])}`)
console.log(`past_due      : ${JSON.stringify(req.past_due ?? [])}`)
console.log(`pending_verification: ${JSON.stringify(req.pending_verification ?? [])}`)
if (req.disabled_reason) console.log(`disabled_reason: ${req.disabled_reason}`)

// 登録済み入金口座（external_accounts）— 番号はマスク
try {
  const ext = await stripe.accounts.listExternalAccounts(acct.id, { object: 'bank_account', limit: 5 })
  console.log(`\n=== 登録済み銀行口座: ${ext.data.length} 件 ===`)
  for (const b of ext.data) {
    console.log(`  ${b.bank_name ?? b.routing_number ?? '?'} / ***${b.last4} / ${b.currency} / status=${b.status} / default=${b.default_for_currency}`)
  }
} catch (e) {
  console.log(`\n(external_accounts 取得不可: ${e.message})`)
}
