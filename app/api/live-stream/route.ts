import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') return NextResponse.json({ error: 'creators_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { title, description, scheduled_at, stream_url, is_premium, premium_price, thumbnail_url } = body
  if (!title || !scheduled_at) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { data: inserted, error } = await supabase
    .from('live_streams')
    .insert({
      creator_id: user.id,
      title: String(title).slice(0, 100),
      description: description ? String(description).slice(0, 500) : null,
      scheduled_at,
      stream_url: stream_url ?? null,
      is_premium: !!is_premium,
      premium_price: is_premium ? Math.max(100, Math.round(Number(premium_price) || 0)) : 0,
      thumbnail_url: thumbnail_url ?? null,
      status: 'scheduled',
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
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!['scheduled', 'live', 'ended', 'cancelled'].includes(status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })

  const updates: Record<string, unknown> = { status }
  if (status === 'ended') updates.ends_at = new Date().toISOString()

  const { error } = await supabase.from('live_streams').update(updates).eq('id', id).eq('creator_id', user.id)
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

  const { error } = await supabase.from('live_streams').delete().eq('id', id).eq('creator_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
