import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: `follow:${user.id}`, limit: 60, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { creator_id } = await req.json()
  if (!creator_id || !UUID_RE.test(creator_id)) {
    return NextResponse.json({ error: 'creator_id required' }, { status: 400 })
  }
  if (creator_id === user.id) {
    return NextResponse.json({ error: '自分自身はフォローできません' }, { status: 400 })
  }

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, creator_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ followed: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: `follow:${user.id}`, limit: 60, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { creator_id } = await req.json()
  if (!creator_id || !UUID_RE.test(creator_id)) {
    return NextResponse.json({ error: 'creator_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('creator_id', creator_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ followed: false })
}
