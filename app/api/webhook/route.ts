/**
 * Stripe Webhook ハンドラ
 *
 * セキュリティ設計:
 *   1. Stripe 署名検証（`stripe-signature` ヘッダで偽イベント拒否）
 *   2. 購入レコードの逆引きは **session.payment_intent_id で行う**
 *      （session.metadata を信用しない＝攻撃者が偽メタデータ仕込んでも被害なし）
 *   3. 冪等性: 既に `status = 'completed'` なら何もしない（Stripe の replay 対策）
 *   4. 監査ログ書き込み
 *
 * 参照: /api/purchase が `purchases` レコード作成時に `stripe_payment_intent_id` を保存しているのが前提。
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServerClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Webhook 用 Service Role クライアント（RLSバイパス、サーバー内のみで使用）
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 監査用にイベント ID を記録（重複処理検知に使える）
  console.log(`[webhook] event=${event.type} id=${event.id}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      }
      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      }
      // 必要に応じて他イベント追加
      default:
        // 未処理イベントも 200 を返す（Stripe が再送し続けるのを避ける）
        break
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    // 内部エラーで 500 を返すと Stripe は最大3日間再試行する。
    // 一時的なエラーなら望ましいが、ロジックバグだと無限ループになる。
    // ここではログに残しつつ 200 を返し、別途運用監視で拾う方針。
  }

  return NextResponse.json({ ok: true })
}

// ─── checkout.session.completed ハンドラ ─────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id

  if (!paymentIntentId) {
    console.warn('[webhook] no payment_intent in session', session.id)
    return
  }

  // ⭐️ 重要: メタデータではなく payment_intent_id で逆引き。
  //   /api/purchase で purchase 作成時に session.payment_intent を保存している。
  //   この方式なら攻撃者が偽メタデータ仕込んだセッションを Stripe で作っても、
  //   こちらの DB に対応する purchase レコードがないので何も起きない。
  const { data: purchase, error: lookupErr } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, coupon_id, status, amount')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()

  if (lookupErr || !purchase) {
    console.warn('[webhook] no purchase for payment_intent:', paymentIntentId)
    return
  }

  // 冪等性: 既に完了済みなら何もしない（Stripe の重複送信対策）
  if (purchase.status === 'completed') {
    console.log('[webhook] already completed, skipping:', purchase.id)
    return
  }

  // status を pending → completed
  const { error: updErr } = await supabase
    .from('purchases')
    .update({ status: 'completed' })
    .eq('id', purchase.id)
    .eq('status', 'pending')  // 楽観ロック: 他のwebhookと競合した場合は失敗させる

  if (updErr) {
    console.error('[webhook] update purchase failed:', updErr)
    return
  }

  // sold_count インクリメント
  await supabase.rpc('increment_sold_count', { content_id: purchase.content_id })

  // クーポン使用回数インクリメント（RPC が無いプロジェクトでもエラーで止まらないように）
  if (purchase.coupon_id) {
    const { error: cpErr } = await supabase.rpc('increment_coupon_used', { coupon_id: purchase.coupon_id })
    if (cpErr) console.warn('[webhook] increment_coupon_used failed:', cpErr.message)
  }

  // 監査ログ
  await supabase.from('audit_logs').insert({
    actor_id: purchase.user_id,
    action: 'purchase.completed',
    target_type: 'purchase',
    target_id: purchase.id,
    metadata: {
      content_id: purchase.content_id,
      amount: purchase.amount,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    },
  })

  // 購入完了メール
  await sendPurchaseEmail(purchase.user_id, purchase.content_id, purchase.id)
}

// ─── charge.refunded ハンドラ ────────────────────────────
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id
  if (!paymentIntentId) return

  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, user_id, content_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()
  if (!purchase) return

  await supabase
    .from('purchases')
    .update({ status: 'refunded' })
    .eq('id', purchase.id)

  await supabase.from('audit_logs').insert({
    actor_id: purchase.user_id,
    action: 'purchase.refunded',
    target_type: 'purchase',
    target_id: purchase.id,
    metadata: {
      stripe_charge_id: charge.id,
      stripe_payment_intent_id: paymentIntentId,
      refund_amount: charge.amount_refunded,
    },
  })
}

// ─── メール送信ヘルパ ─────────────────────────────────
//   後で /lib/email.ts に切り出す候補。ひとまずここに置く。

const BRAND = {
  ink: '#1f1a15',
  primary: '#d36b24',
  bg: '#faf7f3',
  border: '#e6dccb',
  textSub: '#5c5048',
  textMuted: '#9e938a',
}

/** My Focus ブランドのメール HTML テンプレ。本文と CTA を埋め込む */
function brandedEmail(opts: {
  title: string
  greeting: string
  bodyText: string
  cardTitle: string
  cardSub?: string
  ctaText: string
  ctaUrl: string
  ctaColor?: string
}): string {
  return `
  <!doctype html>
  <html lang="ja">
  <head><meta charset="utf-8"></head>
  <body style="margin:0; padding:0; background:${BRAND.bg}; font-family: -apple-system, 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif; color:${BRAND.ink};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.bg};">
      <tr><td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background:#ffffff; border:1px solid ${BRAND.border}; border-radius:16px; overflow:hidden;">
          <!-- ヘッダ：ロゴ＋ブランドライン -->
          <tr><td style="padding:32px 32px 12px; text-align:center; border-bottom:1px solid ${BRAND.border};">
            <p style="margin:0 0 4px; font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:${BRAND.textSub}; font-weight:700;">
              <span style="display:inline-block; width:24px; height:1px; background:${BRAND.primary}; vertical-align:middle; margin-right:10px;"></span>
              My Focus
            </p>
            <p style="margin:0; font-size:10px; letter-spacing:0.16em; color:${BRAND.textMuted};">Issue 01 — 2026 Spring</p>
          </td></tr>
          <!-- 本文 -->
          <tr><td style="padding:32px;">
            <h2 style="margin:0 0 8px; font-family:'Cormorant Garamond', 'Hiragino Mincho ProN', serif; font-size:30px; font-weight:500; font-style:italic; color:${BRAND.ink}; line-height:1.2;">
              ${opts.title}
            </h2>
            <p style="margin:0 0 18px; font-size:13px; color:${BRAND.textSub};">${opts.greeting}</p>
            <div style="background:${BRAND.bg}; border-radius:12px; padding:20px; margin:18px 0; border:1px solid ${BRAND.border};">
              <p style="font-size:15px; font-weight:600; margin:0 0 6px; color:${BRAND.ink};">${opts.cardTitle}</p>
              ${opts.cardSub ? `<p style="color:${BRAND.textMuted}; margin:0; font-size:12px;">${opts.cardSub}</p>` : ''}
            </div>
            <p style="font-size:13px; color:${BRAND.textSub}; line-height:1.75;">${opts.bodyText}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
              <tr><td style="background:${opts.ctaColor ?? BRAND.ink}; border-radius:999px;">
                <a href="${opts.ctaUrl}" style="display:inline-block; padding:14px 30px; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; letter-spacing:0.04em;">
                  ${opts.ctaText} →
                </a>
              </td></tr>
            </table>
          </td></tr>
          <!-- フッタ -->
          <tr><td style="padding:20px 32px 28px; border-top:1px solid ${BRAND.border}; background:${BRAND.bg};">
            <p style="margin:0; font-size:10px; color:${BRAND.textMuted}; line-height:1.6; letter-spacing:0.05em;">
              このメールは My Focus（株式会社91&Co.運営）から自動送信されています。<br>
              心当たりがない場合はお手数ですが <a href="mailto:my-focus@my-focus.jp" style="color:${BRAND.primary}; text-decoration:none;">my-focus@my-focus.jp</a> までご連絡ください。
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`
}

async function sendPurchaseEmail(userId: string, contentId: string, _purchaseId: string) {
  try {
    const { data: user } = await supabase.from('profiles').select('display_name').eq('id', userId).single()
    const { data: content } = await supabase
      .from('contents')
      .select('title, price, creator:profiles(display_name)')
      .eq('id', contentId)
      .single()
    if (!user || !content) return

    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email
    if (!email) return

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'
    const creator = content.creator as { display_name?: string } | null

    const html = brandedEmail({
      title: 'Thank you.',
      greeting: `${user.display_name} さん、ご購入ありがとうございます。`,
      bodyText: 'クリエイターがあなただけのメッセージを書き込んで納品します。<br>マイページから納品状況をご確認いただけます。',
      cardTitle: content.title,
      cardSub: creator?.display_name ? `from ${creator.display_name}` : undefined,
      ctaText: 'マイページで確認',
      ctaUrl: `${appUrl}/mypage`,
    })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'My Focus <noreply@my-focus.jp>',
        to: email,
        subject: `【ご購入ありがとうございます】${content.title}`,
        html,
      }),
    })
  } catch (e) {
    console.error('Purchase email error:', e)
  }
}

export async function sendDeliveryEmail(purchaseId: string) {
  try {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('user_id, content:contents(title, creator:profiles(display_name))')
      .eq('id', purchaseId)
      .single()
    if (!purchase) return

    const { data: authUser } = await supabase.auth.admin.getUserById(purchase.user_id)
    const email = authUser?.user?.email
    if (!email) return

    const { data: userProfile } = await supabase.from('profiles').select('display_name').eq('id', purchase.user_id).single()
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const content = purchase.content as { title?: string; creator?: { display_name?: string } } | null
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

    const html = brandedEmail({
      title: 'Delivered.',
      greeting: `${userProfile?.display_name ?? ''} さん、お待たせしました！`,
      bodyText: 'クリエイターのメッセージ入りコンテンツが届きました。<br>マイページからダウンロードできます。',
      cardTitle: content?.title ?? '',
      cardSub: content?.creator?.display_name ? `from ${content.creator.display_name}` : undefined,
      ctaText: '今すぐダウンロード',
      ctaUrl: `${appUrl}/mypage`,
      ctaColor: BRAND.primary,  // 納品メールはオレンジCTAで気分を上げる
    })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'My Focus <noreply@my-focus.jp>',
        to: email,
        subject: `【納品完了】${content?.title} が届きました ✦`,
        html,
      }),
    })
  } catch (e) {
    console.error('Delivery email error:', e)
  }
}
