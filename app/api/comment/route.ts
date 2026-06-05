/**
 * コンテンツコメント作成 / 削除
 *
 * セキュリティ設計:
 *   - 認証必須
 *   - レート制限（POST: 30req/分、DELETE: 30req/分）
 *   - content_id / parent_id / id の UUID 検証
 *   - body は sanitizeText で制御文字除去 + 長さ制限
 *   - 親コメント (parent_id) が同じ content_id 配下に属することを検証
 *   - 削除は本人のみ（admin 削除は別 API: /api/admin-comment）
 *   - 購入対象が approved な公開コンテンツに限定
 *
 * 注意:
 *   - 表示時に React の JSX 自動エスケープがかかる前提で sanitizeText のみ。
 *     コメントを HTML メール等に流す経路がある場合は escapeHtml も併用する。
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `comment:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const contentId: unknown = body.content_id
  const rawText: unknown = body.body
  const parentId: unknown = body.parent_id ?? null

  if (typeof contentId !== 'string' || !UUID_RE.test(contentId)) {
    return NextResponse.json({ error: 'invalid_content_id' }, { status: 400 })
  }
  if (parentId !== null && (typeof parentId !== 'string' || !UUID_RE.test(parentId))) {
    return NextResponse.json({ error: 'invalid_parent_id' }, { status: 400 })
  }

  // sanitize → 長さチェック（1〜500 chars）
  const text = sanitizeText(rawText, { maxLength: 500, allowNewlines: true })
  if (text.length < 1) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  // 対象コンテンツの存在 + 公開 + approved を確認
  const { data: content } = await supabase
    .from('contents')
    .select('id, is_published, review_status')
    .eq('id', contentId)
    .single()
  if (!content || !content.is_published || content.review_status !== 'approved') {
    return NextResponse.json({ error: 'content_not_found' }, { status: 404 })
  }

  // 親コメントを指定する場合、同じ content_id 配下のコメントであることを検証
  // （別コンテンツのコメントを親に指定して妙なツリーを作るのを防ぐ）
  if (parentId) {
    const { data: parent } = await supabase
      .from('content_comments')
      .select('id, content_id')
      .eq('id', parentId)
      .single()
    if (!parent || parent.content_id !== contentId) {
      return NextResponse.json({ error: 'invalid_parent' }, { status: 400 })
    }
  }

  const { data: inserted, error } = await supabase
    .from('content_comments')
    .insert({ content_id: contentId, user_id: user.id, body: text, parent_id: parentId })
    .select('id, body, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comment: inserted })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `comment-del:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // 本人のコメントのみ削除可（admin による削除は /api/admin-comment 経由）
  const { error } = await supabase
    .from('content_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
