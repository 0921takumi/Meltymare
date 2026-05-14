import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { plan_id } = body
  if (!plan_id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id, creator_id, monthly_price, is_active')
    .eq('id', plan_id)
    .single()
  if (!plan || !plan.is_active) return NextResponse.json({ error: 'plan_not_available' }, { status: 404 })
  if (plan.creator_id === user.id) return NextResponse.json({ error: 'cannot_subscribe_self' }, { status: 400 })

  // 注: 実運用では Stripe Subscription を作成、ここでは DB レコードのみ
  const { data: inserted, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: user.id,
      plan_id,
      creator_id: plan.creator_id,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // member_count インクリメント
  const { data: planRow } = await supabase.from('subscription_plans').select('member_count').eq('id', plan_id).single()
  if (planRow) await supabase.from('subscription_plans').update({ member_count: planRow.member_count + 1 }).eq('id', plan_id)

  return NextResponse.json({ ok: true, id: inserted.id })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { data: sub } = await supabase.from('subscriptions').select('id, plan_id, user_id').eq('id', id).single()
  if (!sub || sub.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: planRow } = await supabase.from('subscription_plans').select('member_count').eq('id', sub.plan_id).single()
  if (planRow && planRow.member_count > 0) await supabase.from('subscription_plans').update({ member_count: planRow.member_count - 1 }).eq('id', sub.plan_id)

  return NextResponse.json({ ok: true })
}
