import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRESET_AMOUNTS = [300, 500, 1000, 3000, 5000, 10000]
const MIN_AMOUNT = 100
const MAX_AMOUNT = 100000

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { creatorId, amount, message } = await req.json()

    if (!creatorId || typeof amount !== 'number') {
      return NextResponse.json({ error: '不正なリクエスト' }, { status: 400 })
    }
    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: `金額は¥${MIN_AMOUNT}〜¥${MAX_AMOUNT}の範囲で指定してください` }, { status: 400 })
    }
    if (user.id === creatorId) {
      return NextResponse.json({ error: '自分自身にチップは送れません' }, { status: 400 })
    }

    const { data: creator } = await supabase
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', creatorId)
      .eq('role', 'creator')
      .single()
    if (!creator) return NextResponse.json({ error: 'クリエイターが見つかりません' }, { status: 404 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `${creator.display_name} へのチップ`,
            description: message ? String(message).slice(0, 200) : undefined,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/creator/${creatorId}?tip=success`,
      cancel_url: `${appUrl}/creator/${creatorId}?tip=cancel`,
      metadata: {
        tip: '1',
        creator_id: creatorId,
        user_id: user.id,
        tip_amount: String(amount),
        tip_message: message ? String(message).slice(0, 200) : '',
      },
    })

    await supabase.from('tips').insert({
      user_id: user.id,
      creator_id: creatorId,
      amount,
      message: message ? String(message).slice(0, 500) : null,
      stripe_payment_intent_id: session.payment_intent as string ?? session.id,
      status: 'pending',
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'チップ処理に失敗しました' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ presets: PRESET_AMOUNTS, min: MIN_AMOUNT, max: MAX_AMOUNT })
}
