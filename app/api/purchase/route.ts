import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { contentId, couponCode, tipPercent: rawTipPercent } = await req.json()

    // チップ率のバリデーション（0/5/10/15 のみ許可）
    const tipPercent: 0 | 5 | 10 | 15 = [0, 5, 10, 15].includes(Number(rawTipPercent))
      ? (Number(rawTipPercent) as 0 | 5 | 10 | 15)
      : 0

    // コンテンツ取得
    const { data: content, error: contentError } = await supabase
      .from('contents')
      .select('*')
      .eq('id', contentId)
      .eq('is_published', true)
      .single()
    if (contentError || !content) return NextResponse.json({ error: 'コンテンツが見つかりません' }, { status: 404 })

    // 在庫チェック
    if (content.stock_limit != null && content.sold_count >= content.stock_limit) {
      return NextResponse.json({ error: 'SOLD OUTです' }, { status: 400 })
    }

    // 重複購入チェック
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('status', 'completed')
      .single()
    if (existing) return NextResponse.json({ error: '既に購入済みです' }, { status: 400 })

    // クーポン検証 & 割引計算
    let discountAmount = 0
    let appliedCouponId: string | null = null

    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('is_active', true)
        .single()

      if (coupon) {
        const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
        const isMaxed = coupon.max_uses != null && coupon.used_count >= coupon.max_uses
        const isMinOk = content.price >= (coupon.min_amount ?? 0)

        if (!isExpired && !isMaxed && isMinOk) {
          discountAmount = coupon.discount_type === 'percent'
            ? Math.floor(content.price * coupon.discount_value / 100)
            : coupon.discount_value
          discountAmount = Math.min(discountAmount, content.price)
          appliedCouponId = coupon.id
        }
      }
    }

    const discountedContentPrice = Math.max(content.price - discountAmount, 0)
    // チップは割引後の商品価格に対して計算（Math.floorで切り捨て統一）
    const tipAmount = Math.floor(discountedContentPrice * tipPercent / 100)
    const finalPrice = discountedContentPrice + tipAmount
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    // 無料（割引100% かつ チップなし）の場合は直接完了
    if (finalPrice === 0) {
      const { data: purchase } = await supabase.from('purchases').insert({
        user_id: user.id,
        content_id: contentId,
        amount: 0,
        content_price: 0,
        tip_amount: 0,
        tip_percent: 0,
        original_amount: content.price,
        discount_amount: discountAmount,
        coupon_id: appliedCouponId,
        stripe_payment_intent_id: `free_${Date.now()}`,
        status: 'completed',
        delivery_status: 'pending',
      }).select().single()

      // クーポン使用回数更新
      if (appliedCouponId) {
        await supabase.from('coupons').update({ used_count: supabase.rpc('increment', { x: 1 }) }).eq('id', appliedCouponId)
      }
      // sold_count 更新
      await supabase.from('contents').update({ sold_count: content.sold_count + 1 }).eq('id', contentId)

      return NextResponse.json({ checkoutUrl: `${appUrl}/purchase/success` })
    }

    // Stripe Checkout Session作成
    // 商品本体は割引後の価格で1明細。チップがあれば別明細として追加（明細上の可視化のため）
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: discountAmount > 0
              ? `${content.title}（クーポン適用後）`
              : content.title,
            images: content.thumbnail_url ? [content.thumbnail_url] : [],
          },
          unit_amount: discountedContentPrice,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/purchase/success`,
      cancel_url: `${appUrl}/contents/${contentId}`,
      metadata: {
        content_id: contentId,
        user_id: user.id,
        coupon_id: appliedCouponId ?? '',
        original_amount: String(content.price),
        discount_amount: String(discountAmount),
        tip_amount: String(tipAmount),
        tip_percent: String(tipPercent),
      },
    }

    // チップがある場合は明細に追加（商品代金への任意の上乗せとして表示）
    if (tipAmount > 0) {
      sessionParams.line_items!.push({
        price_data: {
          currency: 'jpy',
          product_data: { name: `応援チップ (${tipPercent}%)` },
          unit_amount: tipAmount,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // purchaseレコード作成（pending）
    await supabase.from('purchases').insert({
      user_id: user.id,
      content_id: contentId,
      amount: finalPrice,
      content_price: discountedContentPrice,
      tip_amount: tipAmount,
      tip_percent: tipPercent,
      original_amount: content.price,
      discount_amount: discountAmount,
      coupon_id: appliedCouponId,
      stripe_payment_intent_id: session.payment_intent as string ?? session.id,
      status: 'pending',
    })

    return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: '購入処理に失敗しました' }, { status: 500 })
  }
}
