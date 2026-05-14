import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const commentId: string | undefined = body.comment_id
  if (!commentId) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  // toggle
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('comment_likes').delete().eq('id', existing.id)
    return NextResponse.json({ ok: true, liked: false })
  } else {
    const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, liked: true })
  }
}
