/**
 * 管理者用ユーザー操作 API
 *
 * セキュリティ設計:
 *   1. requireAdmin で認可ゲート（lib/auth.ts で一元化）
 *   2. id の UUID 検証
 *   3. suspended_reason は sanitize 通過必須（admin が入力する自由テキスト）
 *   4. role 変更は **`user` ↔ `creator` のみ**。
 *      → SECURITY.md「管理者の `role='admin'` 付与は SQL 直接叩く運用にする
 *        （UI から昇格させない）」に準拠。API 経由で admin 昇格・降格は不可。
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { sanitizeText } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/i

// API 経由で許可するロール（admin は手動 SQL 運用なので除外）
const API_ALLOWED_ROLES = new Set(['user', 'creator'])

export async function PATCH(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const body = await req.json().catch(() => ({}))
  const { id, is_suspended, suspended_reason, role } = body
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (typeof is_suspended === 'boolean') {
    updates.is_suspended = is_suspended
    // admin 入力でも sanitize 必須（制御文字・長さ制限）
    updates.suspended_reason = is_suspended
      ? sanitizeText(suspended_reason, { maxLength: 500, allowNewlines: true }) || null
      : null
    updates.suspended_at = is_suspended ? new Date().toISOString() : null
  }

  if (role !== undefined) {
    if (!API_ALLOWED_ROLES.has(role)) {
      // admin への昇格/admin からの降格は API では一切不可
      return NextResponse.json(
        { error: 'role_change_blocked', detail: 'admin の付与・剥奪は SQL 経由で実施してください' },
        { status: 403 }
      )
    }
    // 自分自身の降格防止
    if (id === user.id) {
      return NextResponse.json({ error: 'cannot_change_own_role' }, { status: 400 })
    }
    // 対象が既に admin の場合も API では変更不可（admin の降格を防ぐ）
    const { data: target } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle()
    if (target?.role === 'admin') {
      return NextResponse.json(
        { error: 'cannot_demote_admin', detail: 'admin の降格は SQL 経由で実施してください' },
        { status: 403 }
      )
    }
    updates.role = role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 監査ログ（admin_actions テーブルが既存。なお audit_logs にも横断記録すべきだが、
  // 既存運用との互換のため両方残すか統合するかは別タスクで判断）
  const action_type =
    is_suspended !== undefined
      ? (is_suspended ? 'user_suspend' : 'user_unsuspend')
      : 'role_change'

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type,
    target_type: 'user',
    target_id: id,
    detail: updates,
  })

  return NextResponse.json({ ok: true })
}
