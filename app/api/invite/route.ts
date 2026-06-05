/**
 * 招待コード管理 API（管理者専用）
 *
 * セキュリティ設計:
 *   - requireAdmin で認可ゲート（lib/auth.ts 統一）
 *   - id の UUID 検証
 *   - note の sanitize
 *   - 招待コードは **crypto.randomInt** で生成（Math.random は暗号学的に安全でない）
 *   - 監査ログを admin_actions に記録（PATCH / DELETE も含む）
 */

import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { requireAdmin } from '@/lib/auth'
import { sanitizeText } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/i
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 紛らわしい文字（I, O, 0, 1）を除外

function generateCode(): string {
  // crypto.randomInt は CSPRNG で生成される暗号学的に安全な乱数
  let s = 'MYF-'
  for (let i = 0; i < 6; i++) s += CODE_CHARS[randomInt(0, CODE_CHARS.length)]
  return s
}

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const body = await req.json().catch(() => ({}))
  const { note, max_uses, days } = body

  const sanitizedNote = sanitizeText(note, { maxLength: 200 }) || null
  const expires_at = days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString() : null
  const clampedMaxUses = Math.max(1, Math.min(100, Number(max_uses) || 1))

  // ユニークコード生成（最大10回リトライ）
  let code = generateCode()
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabase.from('invite_codes').select('id').eq('code', code).maybeSingle()
    if (!existing) break
    code = generateCode()
  }

  const { data: invite, error } = await supabase
    .from('invite_codes')
    .insert({
      code,
      note: sanitizedNote,
      max_uses: clampedMaxUses,
      expires_at,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'invite_create',
    target_type: 'invite_code',
    target_id: invite.id,
    detail: { code, note: sanitizedNote },
  })

  return NextResponse.json({ ok: true, invite })
}

export async function PATCH(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const body = await req.json().catch(() => ({}))
  const { id, is_active } = body
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'invalid_is_active' }, { status: 400 })
  }

  const { error } = await supabase.from('invite_codes').update({ is_active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: is_active ? 'invite_activate' : 'invite_deactivate',
    target_type: 'invite_code',
    target_id: id,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { error } = await supabase.from('invite_codes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'invite_delete',
    target_type: 'invite_code',
    target_id: id,
  })

  return NextResponse.json({ ok: true })
}
