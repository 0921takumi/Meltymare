import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertActorNotSuspended } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeOptional } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // v49: 凍結・退会済みアカウントの素通りを塞ぐ
  const suspendedRes = await assertActorNotSuspended(supabase)
  if (suspendedRes) return suspendedRes

  const rl = await rateLimit({ key: `review:${user.id}`, limit: 20, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { content_id, rating, comment } = await req.json().catch(() => ({}))
  if (!content_id || !UUID_RE.test(content_id)) {
    return NextResponse.json({ error: 'Invalid content_id' }, { status: 400 })
  }
  const ratingNum = Number(rating)
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
  }

  const cleanComment = sanitizeOptional(comment, { maxLength: 1000 })

  // 購入済みチェック
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('content_id', content_id)
    .eq('status', 'completed')
    .maybeSingle()
  if (!purchase) return NextResponse.json({ error: '購入済みコンテンツにのみレビューできます' }, { status: 403 })

  const { data, error } = await supabase
    .from('reviews')
    .upsert({ content_id, user_id: user.id, rating: ratingNum, comment: cleanComment }, { onConflict: 'content_id,user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // v49で発覚: レビュー投稿がクリエイターに一切通知されず、自分からコンテンツ詳細
  // ページを開かない限りレビューが付いたことに気づけなかった（他の通知箇所と同じ穴）。
  const { data: content } = await supabase.from('contents').select('creator_id, title').eq('id', content_id).maybeSingle()
  if (content?.creator_id && content.creator_id !== user.id) {
    const { data: reviewer } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    const admin = createAdminClient()
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: content.creator_id,
      type: 'review',
      title: '新しいレビューが届きました',
      body: `${reviewer?.display_name ?? 'ファン'} さんが「${content.title}」に★${ratingNum}のレビューを投稿しました`,
      link: `/contents/${content_id}`,
    })
    if (notifErr) console.error('[review] notification insert failed:', notifErr.message)
  }

  return NextResponse.json(data)
}
