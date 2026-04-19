import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeOptional } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: `review:${user.id}`, limit: 20, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { content_id, rating, comment } = await req.json()
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
    .single()
  if (!purchase) return NextResponse.json({ error: '購入済みコンテンツにのみレビューできます' }, { status: 403 })

  const { data, error } = await supabase
    .from('reviews')
    .upsert({ content_id, user_id: user.id, rating: ratingNum, comment: cleanComment }, { onConflict: 'content_id,user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
