/**
 * 問い合わせ API
 *
 * セキュリティ設計:
 *   - POST: 認証不要（ログイン前ユーザーも問い合わせ可）。IP ベース rate limit。
 *   - PATCH: requireAdmin 統一 + UUID + sanitize + status/priority ホワイトリスト
 *   - 入力は sanitizeText / sanitizeOptional でフルパス
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { sanitizeText, sanitizeOptional } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i
const ALLOWED_CATEGORIES = new Set(['general', 'bug', 'payment', 'account', 'creator', 'other'])
const ALLOWED_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])
const ALLOWED_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  // IP ベース rate limit（contact と同じ理由：DB スパム防止）
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const rl = await rateLimit({ key: `inquiry:${ip}`, limit: 5, windowSec: 60 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({}))
  const { name, email, subject, body: text, category } = body

  const cleanName = sanitizeText(name, { maxLength: 100, allowNewlines: false })
  const cleanSubject = sanitizeText(subject, { maxLength: 200, allowNewlines: false })
  const cleanBody = sanitizeText(text, { maxLength: 3000, allowNewlines: true })
  const cleanEmail = typeof email === 'string' ? email.trim().slice(0, 200) : ''

  if (!cleanName || !cleanSubject || !cleanBody) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const cat = typeof category === 'string' && ALLOWED_CATEGORIES.has(category) ? category : 'general'

  const { error } = await supabase.from('inquiries').insert({
    user_id: user?.id ?? null,
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    body: cleanBody,
    category: cat,
    priority: 'normal',
    status: 'open',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const body = await req.json().catch(() => ({}))
  const { id, status, resolution_note, priority } = body
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }
  if (priority !== undefined && !ALLOWED_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: 'invalid_priority' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) {
    updates.status = status
    if (status === 'resolved' || status === 'closed') updates.resolved_at = new Date().toISOString()
    updates.assigned_to = user.id
  }
  if (resolution_note !== undefined) {
    updates.resolution_note = sanitizeOptional(resolution_note, { maxLength: 2000, allowNewlines: true })
  }
  if (priority) updates.priority = priority

  const { error } = await supabase.from('inquiries').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'inquiry_update',
    target_type: 'inquiry',
    target_id: id,
    detail: { status, priority },
  })

  return NextResponse.json({ ok: true })
}
