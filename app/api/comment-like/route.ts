/**
 * コメント いいね トグル
 *
 * セキュリティ設計:
 *   - 認証必須
 *   - レート制限（60req/分: いいねは連打する性質なので少し緩め）
 *   - comment_id の UUID 検証
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `comment-like:${user.id}`, limit: 60, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const commentId: unknown = body.comment_id
  if (typeof commentId !== 'string' || !UUID_RE.test(commentId)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // toggle
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('comment_likes').delete().eq('id', existing.id)
    return NextResponse.json({ ok: true, liked: false })
  } else {
    const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, liked: true })
  }
}
