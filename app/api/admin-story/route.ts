import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, reason } = body
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { error } = await supabase.from('stories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'story_delete',
    target_type: 'story',
    target_id: id,
    detail: { reason },
  })

  return NextResponse.json({ ok: true })
}
