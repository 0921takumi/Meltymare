import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({}))
  const { name, email, subject, body: text, category } = body
  if (!name || !email || !subject || !text) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { error } = await supabase.from('inquiries').insert({
    user_id: user?.id ?? null,
    name: String(name).slice(0, 100),
    email: String(email).slice(0, 200),
    subject: String(subject).slice(0, 200),
    body: String(text).slice(0, 3000),
    category: category ?? 'general',
    priority: 'normal',
    status: 'open',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, status, resolution_note, priority } = body
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) {
    updates.status = status
    if (status === 'resolved' || status === 'closed') updates.resolved_at = new Date().toISOString()
    updates.assigned_to = user.id
  }
  if (resolution_note !== undefined) updates.resolution_note = resolution_note
  if (priority) updates.priority = priority

  const { error } = await supabase.from('inquiries').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 監査ログ
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'inquiry_update',
    target_type: 'inquiry',
    target_id: id,
    detail: { status, priority },
  })

  return NextResponse.json({ ok: true })
}
