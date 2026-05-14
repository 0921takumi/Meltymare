import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const formData = await req.formData()
  const id = formData.get('id')?.toString()
  const action = formData.get('action')?.toString()

  if (!id || !action) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  if (action === 'force_stop') {
    const { error } = await supabase.from('live_streams').update({ status: 'ended', ends_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action_type: 'live_force_stop',
      target_type: 'live_stream',
      target_id: id,
    })
  }

  return NextResponse.redirect(new URL('/admin/lives', req.url))
}
