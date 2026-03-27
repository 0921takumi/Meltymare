import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { contentId } = await req.json()

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    // Stripe Checkout Session作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: content.title,
            images: content.thumbnail_url ? [content.thumbnail_url] : [],
          },
          unit_amount: content.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/purchase/success`,
      cancel_url: `${appUrl}/contents/${contentId}`,
      metadata: {
        content_id: contentId,
        user_id: user.id,
      },
    })

    // purchaseレコード作成（pending）
    await supabase.from('purchases').insert({
      user_id: user.id,
      content_id: contentId,
      amount: content.price,
      stripe_payment_intent_id: session.payment_intent as string ?? session.id,
      status: 'pending',
    })

    return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: '購入処理に失敗しました' }, { status: 500 })
  }
}
