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
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f-]{36}$/i
const ALLOWED_ACTIONS = new Set(['hide', 'resolve', 'dismiss'])

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { user } = ctx

  // v49で発覚: これまで content_comments / comment_reports の更新を session client
  // (requireAdmin が返すのは authenticated ロールのクライアント) で行っていたため、
  // content_comments の UPDATE RLS "USING (auth.uid() = user_id)" に阻まれ、admin が
  // 「自分が書いたのではない」コメントを非表示にしようとすると 0 行更新→404 になり、
  // モデレーションの非表示機能そのものが動作していなかった。書き込みは service_role に
  // 集約する（認可は requireAdmin() で担保済み）。
  const admin = createAdminClient()

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

  // 各 update は error と「実際に影響した行数」の両方を検証する。
  // Supabase は 0 行 update でも error:null を返すため、.select() で行の有無を確認し、
  // 失敗・0 行なら監査ログを書く前に中断する（モデレーションの整合性担保）。
  if (action === 'hide') {
    const { data: hidden, error: hideErr } = await admin
      .from('content_comments')
      .update({ is_hidden: true })
      .eq('id', comment_id)
      .select('id, user_id, content_id')
    if (hideErr) return NextResponse.json({ error: hideErr.message }, { status: 500 })
    if (!hidden || hidden.length === 0) {
      return NextResponse.json({ error: 'comment_not_found' }, { status: 404 })
    }

    const { data: resolved, error: resolveErr } = await admin
      .from('comment_reports')
      .update({ status: 'resolved', resolved_by: user.id, resolved_at: now })
      .eq('id', report_id)
      .select('id')
    if (resolveErr) return NextResponse.json({ error: resolveErr.message }, { status: 500 })
    if (!resolved || resolved.length === 0) {
      return NextResponse.json({ error: 'report_not_found' }, { status: 404 })
    }

    // v49で発覚: 通報対応でコメントを非表示にしても投稿者本人には何も知らされず、
    // 自分のコメントが（Comments.tsx上「あなたにのみ表示」の非表示状態で）消えたことに
    // 気づく手段が無かった。
    const hiddenComment = hidden[0]
    if (hiddenComment.user_id) {
      const { error: notifErr } = await admin.from('notifications').insert({
        user_id: hiddenComment.user_id,
        type: 'comment_hidden',
        title: 'コメントが非表示になりました',
        body: '通報に基づき、あなたのコメントの一つが非表示になりました。',
        link: `/contents/${hiddenComment.content_id}`,
      })
      if (notifErr) console.error('[admin-comment] notification insert failed:', notifErr.message)
    }
  } else if (action === 'resolve') {
    const { data: resolved, error: resolveErr } = await admin
      .from('comment_reports')
      .update({ status: 'resolved', resolved_by: user.id, resolved_at: now })
      .eq('id', report_id)
      .select('id')
    if (resolveErr) return NextResponse.json({ error: resolveErr.message }, { status: 500 })
    if (!resolved || resolved.length === 0) {
      return NextResponse.json({ error: 'report_not_found' }, { status: 404 })
    }
  } else if (action === 'dismiss') {
    const { data: dismissed, error: dismissErr } = await admin
      .from('comment_reports')
      .update({ status: 'dismissed', resolved_by: user.id, resolved_at: now })
      .eq('id', report_id)
      .select('id')
    if (dismissErr) return NextResponse.json({ error: dismissErr.message }, { status: 500 })
    if (!dismissed || dismissed.length === 0) {
      return NextResponse.json({ error: 'report_not_found' }, { status: 404 })
    }
  }

  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action_type: `comment_report_${action}`,
    target_type: 'comment',
    target_id: comment_id ?? null,
    detail: { report_id },
  })

  return NextResponse.json({ ok: true })
}
