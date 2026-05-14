import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const creatorId: string | undefined = body.creator_id
  const message: string | undefined = body.message
  const isPublic: boolean = body.is_public !== false

  if (!creatorId || !message || message.trim().length < 1 || message.length > 500) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  // クリエイター存在確認 + 受付フラグ
  const { data: creator } = await supabase
    .from('profiles')
    .select('id, role, accepts_birthday_messages, birthdate')
    .eq('id', creatorId)
    .single()

  if (!creator || creator.role !== 'creator') return NextResponse.json({ error: 'creator_not_found' }, { status: 404 })
  if (!creator.accepts_birthday_messages) return NextResponse.json({ error: 'not_accepting' }, { status: 403 })
  if (!creator.birthdate) return NextResponse.json({ error: 'no_birthdate' }, { status: 400 })

  const year = new Date().getFullYear()
  const { error } = await supabase.from('birthday_messages').insert({
    creator_id: creatorId,
    user_id: user.id,
    message: message.trim(),
    is_public: isPublic,
    year,
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_sent' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
