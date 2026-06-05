/**
 * 管理者用コメント通報処理 API
 *
 * セキュリティ設計:
 *   - requireAdmin で認可ゲート
 *   - report_id / comment_id の UUID 検証
 *   - 許可 action のホワイトリスト化
 *   - 監査ログを admin_actions に記録
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

const UUID_RE = /^[0-9a-f-]{36}$/i
const ALLOWED_ACTIONS = new Set(['hide', 'resolve', 'dismiss'])

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const body = await req.json().catch(() => ({}))
  const { report_id, comment_id, action } = body

  if (typeof report_id !== 'string' || !UUID_RE.test(report_id)) {
    return NextResponse.json({ error: 'invalid_report_id' }, { status: 400 })
  }
  if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }
  // hide のみ comment_id が必要
  if (action === 'hide') {
    if (typeof comment_id !== 'string' || !UUID_RE.test(comment_id)) {
      return NextResponse.json({ error: 'invalid_comment_id' }, { status: 400 })
    }
  }

  const now = new Date().toISOString()

  if (action === 'hide') {
    await supabase.from('content_comments').update({ is_hidden: true }).eq('id', comment_id)
    await supabase
      .from('comment_reports')
      .update({ status: 'resolved', resolved_by: user.id, resolved_at: now })
      .eq('id', report_id)
  } else if (action === 'resolve') {
    await supabase
      .from('comment_reports')
      .update({ status: 'resolved', resolved_by: user.id, resolved_at: now })
      .eq('id', report_id)
  } else if (action === 'dismiss') {
    await supabase
      .from('comment_reports')
      .update({ status: 'dismissed', resolved_by: user.id, resolved_at: now })
      .eq('id', report_id)
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
