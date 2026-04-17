import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServerClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Webhookは認証なしのService Roleクライアントを使う
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { content_id, user_id, coupon_id } = session.metadata ?? {}
    if (!content_id || !user_id) return NextResponse.json({ ok: true })

    // purchaseをcompletedに更新
    const { data: purchase } = await supabase
      .from('purchases')
      .update({ status: 'completed' })
      .eq('content_id', content_id)
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .select('id, amount')
      .single()

    // sold_countをインクリメント
    await supabase.rpc('increment_sold_count', { content_id })

    // クーポン使用回数をインクリメント
    if (coupon_id) {
      await supabase
        .from('coupons')
        .update({ used_count: supabase.rpc('increment', { x: 1 }) as any })
        .eq('id', coupon_id)
    }

    // 購入完了メール送信
    if (purchase) {
      await sendPurchaseEmail(user_id, content_id, purchase.id)
    }
  }

  return NextResponse.json({ ok: true })
}

async function sendPurchaseEmail(userId: string, contentId: string, purchaseId: string) {
  try {
    const { data: user } = await supabase.from('profiles').select('display_name').eq('id', userId).single()
    const { data: content } = await supabase
      .from('contents')
      .select('title, price, creator:profiles(display_name, id)')
      .eq('id', contentId)
      .single()

    if (!user || !content) return

    // Supabase Authのメールアドレス取得
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email
    if (!email) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'
    const creator = content.creator as any

    // Resend / SMTP がなければ Supabase Edge Function or fetch
    // ここでは Resend API を使う（RESEND_API_KEY 環境変数が必要）
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return // キーなければスキップ

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MyFocus <noreply@my-focus.jp>',
        to: email,
        subject: `【購入完了】${content.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fafafa;">
            <h2 style="color: #2d6a9f; margin-bottom: 8px;">ご購入ありがとうございます 🎉</h2>
            <p style="color: #555;">${user.display_name} さん、ご購入が完了しました。</p>

            <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <p style="font-size: 16px; font-weight: bold; margin: 0 0 8px;">${content.title}</p>
              <p style="color: #888; margin: 0;">クリエイター: ${creator?.display_name ?? ''}</p>
            </div>

            <p style="color: #555;">クリエイターがあなただけのメッセージを書き込んで納品します。<br>マイページから納品状況をご確認いただけます。</p>

            <a href="${appUrl}/mypage" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2d6a9f; color: white; border-radius: 8px; text-decoration: none; font-weight: bold;">
              マイページで確認する
            </a>

            <p style="margin-top: 32px; font-size: 12px; color: #aaa;">このメールは MyFocus から自動送信されています。</p>
          </div>
        `,
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

    const content = purchase.content as any
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MyFocus <noreply@my-focus.jp>',
        to: email,
        subject: `【納品完了】${content?.title} が届きました！`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fafafa;">
            <h2 style="color: #059669; margin-bottom: 8px;">コンテンツが納品されました 📦</h2>
            <p style="color: #555;">${userProfile?.display_name} さん、お待たせしました！</p>

            <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <p style="font-size: 16px; font-weight: bold; margin: 0 0 8px;">${content?.title}</p>
              <p style="color: #888; margin: 0;">クリエイター: ${content?.creator?.display_name ?? ''}</p>
            </div>

            <p style="color: #555;">マイページからダウンロードできます。</p>

            <a href="${appUrl}/mypage" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #059669; color: white; border-radius: 8px; text-decoration: none; font-weight: bold;">
              今すぐダウンロード
            </a>

            <p style="margin-top: 32px; font-size: 12px; color: #aaa;">このメールは MyFocus から自動送信されています。</p>
          </div>
        `,
      }),
    })
  } catch (e) {
    console.error('Delivery email error:', e)
  }
}
