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
    const { content_id, user_id } = session.metadata ?? {}
    if (!content_id || !user_id) return NextResponse.json({ ok: true })

    // purchaseをcompletedに更新
    await supabase
      .from('purchases')
      .update({ status: 'completed' })
      .eq('content_id', content_id)
      .eq('user_id', user_id)
      .eq('status', 'pending')

    // sold_countをインクリメント
    await supabase.rpc('increment_sold_count', { content_id })
  }

  return NextResponse.json({ ok: true })
}
