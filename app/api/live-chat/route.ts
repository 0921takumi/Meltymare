import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const streamId: string | undefined = body.stream_id
  const text: string | undefined = body.body
  const isSuper: boolean = !!body.is_super_chat
  const amount: number | null = isSuper ? Number(body.super_chat_amount) : null

  if (!streamId || !text || text.trim().length < 1 || text.length > 200) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (isSuper && (!amount || amount < 100)) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
  }

  const { data: stream } = await supabase.from('live_streams').select('id, status').eq('id', streamId).single()
  if (!stream || stream.status !== 'live') return NextResponse.json({ error: 'not_live' }, { status: 400 })

  const { data: inserted, error } = await supabase
    .from('live_chat_messages')
    .insert({
      stream_id: streamId,
      user_id: user.id,
      body: text.trim(),
      is_super_chat: isSuper,
      super_chat_amount: amount,
    })
    .select('id, body, is_super_chat, super_chat_amount, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', user.id).single()
  return NextResponse.json({ ok: true, message: { ...inserted, user: profile } })
}
