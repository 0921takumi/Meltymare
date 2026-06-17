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
import { createAdminClient } from '@/lib/supabase/admin'
import { escapeHtml } from '@/lib/sanitize'

// apiVersion を明示固定（SDK更新時の挙動変化で決済不整合になるのを防ぐ）
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

// Webhook 用 Service Role クライアント（RLSバイパス、サーバー内のみで使用）
// 命名: @supabase/ssr の createServerClient と紛らわしいので createServiceClient で別名 import している。
const supabase = createAdminClient()

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
  const metadata = session.metadata ?? {}

  // ── チップ決済の場合 ──
  // チップは purchases ではなく tips テーブルで管理。metadata.tip === '1' で判別。
  if (metadata.tip === '1') {
    // ⭐️ tips を一意特定するキーは stripe_payment_intent_id。
    //   /api/tip は作成時に `session.payment_intent ?? session.id` を保存している
    //   （Checkout 作成時点では payment_intent が未確定なことが多いため）。
    //   purchases と同じく、session.id と payment_intent の両方で照合する。
    //
    //   旧実装は (creator_id, user_id, status=pending) でだけ絞っていたため、
    //   同一ユーザーが同一クリエイターに連続でチップを送ると、無関係の pending tip
    //   まで巻き込んで completed にしてしまう不具合があった。
    const sessionId = session.id
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

    const orFilter = paymentIntentId
      ? `stripe_payment_intent_id.eq.${sessionId},stripe_payment_intent_id.eq.${paymentIntentId}`
      : `stripe_payment_intent_id.eq.${sessionId}`

    const { data: tip, error: lookupErr } = await supabase
      .from('tips')
      .select('id, user_id, creator_id, amount, status')
      .or(orFilter)
      .maybeSingle()

    if (lookupErr || !tip) {
      console.warn('[webhook] no tip for session:', sessionId, 'pi:', paymentIntentId)
      return
    }

    // 冪等性: 既に完了済みなら何もしない（Stripe の重複送信対策）
    if (tip.status === 'completed') {
      console.log('[webhook] tip already completed, skipping:', tip.id)
      return
    }

    // status を pending → completed。
    // payment_intent_id も実値で上書きしておく（後続イベントの照合用）。
    const { error: updErr } = await supabase
      .from('tips')
      .update({
        status: 'completed',
        ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
      })
      .eq('id', tip.id)
      .eq('status', 'pending')  // 楽観ロック

    if (updErr) {
      console.error('[webhook] update tip failed:', updErr)
      return
    }

    // 金額は **Stripe イベントオブジェクト** から取る（署名検証済みのため改竄不可）。
    // metadata.tip_amount を信用しない（冒頭の設計方針に従う）。
    const tipAmount = session.amount_total ?? tip.amount ?? 0

    // クリエイターに通知（display_name は HTML 不使用だが念のため）
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', tip.user_id)
      .single()

    await supabase.from('notifications').insert({
      user_id: tip.creator_id,
      type: 'tip',
      title: 'チップを受け取りました 🎁',
      body: `${sender?.display_name ?? 'ファン'} さんから ¥${Number(tipAmount).toLocaleString()} のチップ`,
      link: '/creator/dashboard',
    })

    // 監査ログ（purchase と同じ粒度で残す）
    await supabase.from('audit_logs').insert({
      actor_id: tip.user_id,
      action: 'tip.completed',
      target_type: 'tip',
      target_id: tip.id,
      metadata: {
        creator_id: tip.creator_id,
        amount: tipAmount,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
      },
    })

    return
  }

  // ── 通常のコンテンツ購入 ──
  const sessionId = session.id
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id

  // ⭐️ 逆引きキー: /api/purchase は作成時に `session.payment_intent ?? session.id` を
  //   stripe_payment_intent_id に保存している。Checkout 作成時点では payment_intent が
  //   未確定（null）なことが多く、その場合は session.id（cs_...）が保存される。
  //   よって webhook 側は **session.id と payment_intent の両方** で照合する。
  //   メタデータは信用しない（偽イベント対策）。Stripe 署名検証済みなので
  //   こちらの DB に対応レコードがある時だけ処理が走る。
  const orFilter = paymentIntentId
    ? `stripe_payment_intent_id.eq.${sessionId},stripe_payment_intent_id.eq.${paymentIntentId}`
    : `stripe_payment_intent_id.eq.${sessionId}`
  const { data: purchase, error: lookupErr } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, coupon_id, status, amount')
    .or(orFilter)
    .maybeSingle()

  if (lookupErr || !purchase) {
    console.warn('[webhook] no purchase for session:', sessionId, 'pi:', paymentIntentId)
    return
  }

  // 冪等性: 既に完了済みなら何もしない（Stripe の重複送信対策）
  if (purchase.status === 'completed') {
    console.log('[webhook] already completed, skipping:', purchase.id)
    return
  }

  // status を pending → completed。
  // 同時に stripe_payment_intent_id を実際の payment_intent に更新しておく
  // （charge.refunded ハンドラが payment_intent で逆引きするため）。
  const { data: updatedPurchase, error: updErr } = await supabase
    .from('purchases')
    .update({
      status: 'completed',
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq('id', purchase.id)
    .eq('status', 'pending')  // 楽観ロック: 他のwebhookと競合した場合は失敗させる
    .select('id')
    .maybeSingle()

  if (updErr) {
    console.error('[webhook] update purchase failed:', updErr)
    return
  }
  // 0行更新 = 別の webhook が先に completed 化済み。sold_count/通知/メールを二重に
  // 走らせないため、ここで終了する（charge.refunded ハンドラと同じ 0 行検知パターンに統一）。
  if (!updatedPurchase) {
    console.log('[webhook] purchase already completed by concurrent webhook, skipping:', purchase.id)
    return
  }

  // 防御的: 実課金額(session.amount_total)とDB記録(purchase.amount)の乖離を検知。
  // Stripe Checkout は金額改竄不可だが、万一の不整合（pending作成後のクーポン枯渇との
  // 競合等）を監査ログに残して可視化する。決済確定自体は止めない（既に課金済みのため）。
  if (session.amount_total != null && purchase.amount != null && session.amount_total !== purchase.amount) {
    console.error(`[webhook] amount mismatch purchase=${purchase.id} db=${purchase.amount} stripe=${session.amount_total}`)
    await supabase.from('audit_logs').insert({
      actor_id: purchase.user_id,
      action: 'purchase.amount_mismatch',
      target_type: 'purchase',
      target_id: purchase.id,
      metadata: { db_amount: purchase.amount, stripe_amount: session.amount_total, stripe_session_id: session.id },
    })
  }

  // sold_count インクリメント
  await supabase.rpc('increment_sold_count', { content_id: purchase.content_id })

  // クーポン使用回数インクリメント（v15 以降 CAS 化、戻り値 boolean）。
  // false の場合は並列 webhook で他の購入が先に上限に到達した可能性。
  // discountAmount は既に適用済み（webhook 着信時点で決済は完了）なので返金は行わず、
  // 監査ログだけ残して上限超過を可視化する。
  if (purchase.coupon_id) {
    const { data: incOk, error: cpErr } = await supabase.rpc('increment_coupon_used', { coupon_id: purchase.coupon_id })
    if (cpErr) {
      console.warn('[webhook] increment_coupon_used failed:', cpErr.message)
    } else if (incOk === false) {
      console.warn('[webhook] coupon already at max_uses, no-op:', purchase.coupon_id)
      await supabase.from('audit_logs').insert({
        actor_id: purchase.user_id,
        action: 'coupon.max_uses_overrun',
        target_type: 'coupon',
        target_id: purchase.coupon_id,
        metadata: { purchase_id: purchase.id },
      })
    }
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

  // アプリ内通知（購入者 + クリエイター）。
  // 行欠落で .single() 例外→Stripeへ200返却→リトライ無し で通知が静かに消えるのを防ぐ
  // ため .maybeSingle() 化し、insert の error も必ずログに残す（売上通知のサイレント欠損防止）。
  const { data: content } = await supabase
    .from('contents')
    .select('title, creator_id')
    .eq('id', purchase.content_id)
    .maybeSingle()
  if (content) {
    const { error: buyerNotifErr } = await supabase.from('notifications').insert({
      user_id: purchase.user_id,
      type: 'purchase',
      title: 'ご購入ありがとうございます',
      body: `${content.title} の購入が完了しました`,
      link: '/mypage',
    })
    if (buyerNotifErr) console.error('[webhook] buyer notification insert failed:', buyerNotifErr.message, 'purchase:', purchase.id)
    const { data: buyer } = await supabase.from('profiles').select('display_name').eq('id', purchase.user_id).maybeSingle()
    const { error: creatorNotifErr } = await supabase.from('notifications').insert({
      user_id: content.creator_id,
      type: 'purchase',
      title: '新しい購入がありました',
      body: `${buyer?.display_name ?? 'ファン'} さんが ${content.title} を購入しました`,
      link: '/creator/orders',
    })
    if (creatorNotifErr) console.error('[webhook] creator notification insert failed:', creatorNotifErr.message, 'purchase:', purchase.id)
  } else {
    console.error('[webhook] content not found; purchase notifications skipped. content_id:', purchase.content_id, 'purchase:', purchase.id)
  }
}

// ─── charge.refunded ハンドラ ────────────────────────────
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id
  if (!paymentIntentId) return

  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (!purchase) return

  // 状態遷移は completed → refunded のみ許可。
  // 並列 webhook で順序逆転（refunded が先に到着 → 後から completed が上書き）した場合、
  // または既に refunded 済みの purchase に対するリプレイの場合、いずれも no-op で安全に弾く。
  const { data: updated, error: updErr } = await supabase
    .from('purchases')
    .update({ status: 'refunded' })
    .eq('id', purchase.id)
    .eq('status', 'completed')  // 楽観ロック + ホワイトリスト
    .select('id')
    .maybeSingle()

  if (updErr) {
    console.error('[webhook] refund update failed:', updErr)
    return
  }
  if (!updated) {
    // 既に refunded、または completed でない（pending のまま等）。冪等として終了。
    console.log('[webhook] refund skipped (not in completed state):', purchase.id, 'current:', purchase.status)
    return
  }

  // 返金確定後、sold_count を1戻す（限定枠 stock_limit の永久目減り＝SOLD OUT 固着を防ぐ）。
  // 返金は低頻度のため read-modify-write で十分（atomic な decrement RPC 化は将来課題）。
  // status='completed'→'refunded' の楽観ロックを1回通った時のみ到達するので二重デクリメントは無い。
  const { data: refundedContent } = await supabase
    .from('contents')
    .select('sold_count')
    .eq('id', purchase.content_id)
    .maybeSingle()
  if (refundedContent && typeof refundedContent.sold_count === 'number' && refundedContent.sold_count > 0) {
    const { error: decErr } = await supabase
      .from('contents')
      .update({ sold_count: refundedContent.sold_count - 1 })
      .eq('id', purchase.content_id)
    if (decErr) console.warn('[webhook] refund sold_count decrement failed:', decErr.message)
  }

  // 監査ログ
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

  // 返金通知（旧実装には無かった。ユーザーが返金に気づけないと信用毀損につながるため追加）。
  // content 削除と並走しても通知が落ちないよう .maybeSingle()（title は ?? でフォールバック）。
  const { data: content } = await supabase
    .from('contents')
    .select('title')
    .eq('id', purchase.content_id)
    .maybeSingle()

  const { error: refundNotifErr } = await supabase.from('notifications').insert({
    user_id: purchase.user_id,
    type: 'refund',
    title: 'ご返金が完了しました',
    body: `${content?.title ?? 'コンテンツ'} のご購入を返金しました。Stripe からの返金処理は数営業日以内にご利用カードに反映されます。`,
    link: '/mypage',
  })
  if (refundNotifErr) console.error('[webhook] refund notification insert failed:', refundNotifErr.message, 'purchase:', purchase.id)
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

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'My Focus <noreply@my-focus.jp>'

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

    // ⚠️ HTMLメールはReactではないので {} の自動エスケープが効かない。
    //   display_name / title は必ず escapeHtml を通すこと。
    //   （プロフィール編集側でも sanitizeText しているが、ここでも二重防御）
    const html = brandedEmail({
      title: 'Thank you.',
      greeting: `${escapeHtml(user.display_name)} さん、ご購入ありがとうございます。`,
      bodyText: 'クリエイターがあなただけのメッセージを書き込んで納品します。<br>マイページから納品状況をご確認いただけます。',
      cardTitle: escapeHtml(content.title),
      cardSub: creator?.display_name ? `from ${escapeHtml(creator.display_name)}` : undefined,
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
        from: FROM_EMAIL,
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

    // ⚠️ HTMLメールはReactではないので {} の自動エスケープが効かない。escapeHtml 必須。
    const html = brandedEmail({
      title: 'Delivered.',
      greeting: `${escapeHtml(userProfile?.display_name ?? '')} さん、お待たせしました！`,
      bodyText: 'クリエイターのメッセージ入りコンテンツが届きました。<br>マイページからダウンロードできます。',
      cardTitle: escapeHtml(content?.title ?? ''),
      cardSub: content?.creator?.display_name ? `from ${escapeHtml(content.creator.display_name)}` : undefined,
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
        from: FROM_EMAIL,
        to: email,
        subject: `【納品完了】${content?.title} が届きました ✦`,
        html,
      }),
    })
  } catch (e) {
    console.error('Delivery email error:', e)
  }
}
