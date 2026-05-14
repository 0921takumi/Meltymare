import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true })

  const body = await req.json().catch(() => ({}))
  const storyId: string | undefined = body.story_id
  if (!storyId) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  // upsert (UNIQUE on story_id, user_id) — 既読なら何もしない
  const { error: insertErr } = await supabase
    .from('story_views')
    .insert({ story_id: storyId, user_id: user.id })

  // 既読でない場合のみ view_count をインクリメント (atomic 化は後日)
  if (!insertErr) {
    const { data: story } = await supabase.from('stories').select('view_count').eq('id', storyId).single()
    if (story) await supabase.from('stories').update({ view_count: story.view_count + 1 }).eq('id', storyId)
  }
  return NextResponse.json({ ok: true })
}
