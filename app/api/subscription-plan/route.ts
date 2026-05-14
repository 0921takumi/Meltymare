import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, description, monthly_price, benefits, badge_emoji, badge_color, is_active } = body
  if (!name || typeof monthly_price !== 'number' || monthly_price < 500) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('subscription_plans')
    .insert({
      creator_id: user.id,
      name: String(name).slice(0, 40),
      description: description ? String(description).slice(0, 200) : null,
      monthly_price,
      benefits: Array.isArray(benefits) ? benefits.slice(0, 10) : [],
      badge_emoji: badge_emoji ?? '⭐',
      badge_color: badge_color ?? '#a855f7',
      is_active: is_active !== false,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: inserted.id })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id, name, description, monthly_price, benefits, badge_emoji, badge_color, is_active } = body
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { error } = await supabase
    .from('subscription_plans')
    .update({
      name: String(name).slice(0, 40),
      description: description ? String(description).slice(0, 200) : null,
      monthly_price,
      benefits: Array.isArray(benefits) ? benefits.slice(0, 10) : [],
      badge_emoji,
      badge_color,
      is_active,
    })
    .eq('id', id)
    .eq('creator_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { error } = await supabase
    .from('subscription_plans')
    .delete()
    .eq('id', id)
    .eq('creator_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
