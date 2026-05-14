import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { report_id, comment_id, action } = body
  if (!report_id || !action) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  if (action === 'hide' && comment_id) {
    await supabase.from('content_comments').update({ is_hidden: true }).eq('id', comment_id)
    await supabase.from('comment_reports').update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('id', report_id)
  } else if (action === 'resolve') {
    await supabase.from('comment_reports').update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('id', report_id)
  } else if (action === 'dismiss') {
    await supabase.from('comment_reports').update({ status: 'dismissed', resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('id', report_id)
  }

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: `comment_report_${action}`,
    target_type: 'comment',
    target_id: comment_id ?? null,
    detail: { report_id },
  })

  return NextResponse.json({ ok: true })
}
