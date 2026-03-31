import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { creator_id, message, budget } = await req.json()
  if (!creator_id || !message?.trim()) {
    return NextResponse.json({ error: 'creator_id と message は必須です' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('requests')
    .insert({ user_id: user.id, creator_id, message: message.trim(), budget: budget || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, creator_reply } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // creatorであることを確認
  const { data: req_ } = await supabase.from('requests').select('creator_id').eq('id', id).single()
  if (req_?.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('requests')
    .update({ status, creator_reply: creator_reply?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
