import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content_id, rating, comment } = await req.json()
  if (!content_id || !rating) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (rating < 1 || rating > 5) return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })

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
    .upsert({ content_id, user_id: user.id, rating, comment: comment?.trim() || null }, { onConflict: 'content_id,user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
