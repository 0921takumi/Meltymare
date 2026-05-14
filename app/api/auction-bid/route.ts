import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'creators_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { auction_id, bid_amount, message, estimated_days } = body
  if (!auction_id || typeof bid_amount !== 'number' || !message || typeof estimated_days !== 'number') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { data: auction } = await supabase
    .from('request_auctions')
    .select('id, status, user_id, deadline')
    .eq('id', auction_id)
    .single()
  if (!auction) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (auction.status !== 'open') return NextResponse.json({ error: 'closed' }, { status: 400 })
  if (new Date(auction.deadline) < new Date()) return NextResponse.json({ error: 'expired' }, { status: 400 })
  if (auction.user_id === user.id) return NextResponse.json({ error: 'self_bid' }, { status: 400 })

  const { error } = await supabase
    .from('auction_bids')
    .insert({
      auction_id,
      creator_id: user.id,
      bid_amount: Math.round(bid_amount),
      message: message.trim().slice(0, 500),
      estimated_days: Math.max(1, Math.min(90, estimated_days)),
    })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_bid' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
