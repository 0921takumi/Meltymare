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
import { assertActorNotSuspended } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // v49: 凍結・退会済みアカウントの素通りを塞ぐ
  const suspendedRes = await assertActorNotSuspended(supabase)
  if (suspendedRes) return suspendedRes

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
    .select('id, role, accepts_birthday_messages, birthdate, is_suspended, deleted_at')
    .eq('id', creatorId)
    .maybeSingle()

  if (!creator || creator.role !== 'creator') return NextResponse.json({ error: 'creator_not_found' }, { status: 404 })
  // v49: 凍結・退会済みクリエイターへのメッセージ送信を止める
  if (creator.is_suspended || creator.deleted_at) return NextResponse.json({ error: 'creator_not_found' }, { status: 404 })
  if (!creator.accepts_birthday_messages) return NextResponse.json({ error: 'not_accepting' }, { status: 403 })
  if (!creator.birthdate) return NextResponse.json({ error: 'no_birthdate' }, { status: 400 })

  // v37: insert は service_role(admin) で行う。birthday_messages の RLS を「本人であること」
  // 以上に強めるには受信側クリエイターの role/accepts/birthdate を参照する必要があるが、
  // それらは v22 で authenticated から列単位 REVOKE 済みのため、authenticated セッションの
  // RLS ポリシー内から参照すると "permission denied for table profiles" になる。
  // 業務ルール（自分宛禁止・受付クリエイターのみ）は上で service_role により検証済みなので、
  // purchases/tips と同じく実書き込みを admin に集約し、authenticated 直 insert は封じる。
  const year = new Date().getFullYear()
  const { error } = await admin.from('birthday_messages').insert({
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

  // 監査で発覚: バースデーメッセージがDBに保存されるだけで、通知も閲覧画面も一切無く、
  // クリエイターが受け取った事実を知る手段が構造的に無かった（機能がブラックホール化）。
  const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: creatorId,
    type: 'birthday_message',
    title: 'バースデーメッセージが届きました 🎂',
    body: `${sender?.display_name ?? 'ファン'} さんからメッセージが届きました`,
    link: '/creator/dashboard',
  })
  if (notifErr) console.error('[birthday-message] notification insert failed:', notifErr.message)

  return NextResponse.json({ ok: true })
}
