import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const contentId: string | undefined = body.content_id
  const text: string | undefined = body.body
  const parentId: string | undefined = body.parent_id

  if (!contentId || !text || text.trim().length < 1 || text.length > 500) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const { data: content } = await supabase.from('contents').select('id, is_published').eq('id', contentId).single()
  if (!content || !content.is_published) return NextResponse.json({ error: 'content_not_found' }, { status: 404 })

  const { data: inserted, error } = await supabase
    .from('content_comments')
    .insert({ content_id: contentId, user_id: user.id, body: text.trim(), parent_id: parentId ?? null })
    .select('id, body, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comment: inserted })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { error } = await supabase.from('content_comments').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
