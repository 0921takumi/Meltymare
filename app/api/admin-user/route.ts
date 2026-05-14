import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, is_suspended, suspended_reason, role } = body
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (typeof is_suspended === 'boolean') {
    updates.is_suspended = is_suspended
    updates.suspended_reason = is_suspended ? (suspended_reason ?? null) : null
    updates.suspended_at = is_suspended ? new Date().toISOString() : null
  }
  if (role && ['user', 'creator', 'admin'].includes(role)) {
    if (id === user.id && role !== 'admin') return NextResponse.json({ error: 'cannot_demote_self' }, { status: 400 })
    updates.role = role
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: is_suspended !== undefined ? (is_suspended ? 'user_suspend' : 'user_unsuspend') : 'role_change',
    target_type: 'user',
    target_id: id,
    detail: updates,
  })

  return NextResponse.json({ ok: true })
}
