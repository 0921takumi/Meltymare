/**
 * バースデーメッセージ送信
 *
 * セキュリティ設計:
 *   - 認証必須 + レート制限
 *   - creator_id の UUID 検証
 *   - message を sanitizeText
 *   - 自分宛送信ブロック
 *   - 受付フラグ + 誕生日設定確認
 *   - 1年1メッセージのユニーク制約（DB側）
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `birthday-msg:${user.id}`, limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const creatorId: unknown = body.creator_id
  const isPublic: boolean = body.is_public !== false

  if (typeof creatorId !== 'string' || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ error: 'invalid_creator_id' }, { status: 400 })
  }
  if (creatorId === user.id) {
    return NextResponse.json({ error: 'cannot_send_self' }, { status: 400 })
  }

  const message = sanitizeText(body.message, { maxLength: 500, allowNewlines: true })
  if (message.length < 1) {
    return NextResponse.json({ error: 'invalid_message' }, { status: 400 })
  }

  // クリエイター存在確認 + 受付フラグ
  // v22: accepts_birthday_messages / birthdate（PII）は anon/authenticated では読めない。
  // 受付可否の判定のみに使うため service_role で最小限を取得する（値は返さない）。
  const admin = createAdminClient()
  const { data: creator } = await admin
    .from('profiles')
    .select('id, role, accepts_birthday_messages, birthdate')
    .eq('id', creatorId)
    .single()

  if (!creator || creator.role !== 'creator') return NextResponse.json({ error: 'creator_not_found' }, { status: 404 })
  if (!creator.accepts_birthday_messages) return NextResponse.json({ error: 'not_accepting' }, { status: 403 })
  if (!creator.birthdate) return NextResponse.json({ error: 'no_birthdate' }, { status: 400 })

  const year = new Date().getFullYear()
  const { error } = await supabase.from('birthday_messages').insert({
    creator_id: creatorId,
    user_id: user.id,
    message,
    is_public: isPublic,
    year,
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_sent' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
