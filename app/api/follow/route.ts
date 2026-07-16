import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertActorNotSuspended } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // v49: 凍結・退会済みアカウントの素通りを塞ぐ
  const suspendedRes = await assertActorNotSuspended(supabase)
  if (suspendedRes) return suspendedRes

  const rl = await rateLimit({ key: `follow:${user.id}`, limit: 60, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { creator_id } = await req.json().catch(() => ({}))
  if (!creator_id || !UUID_RE.test(creator_id)) {
    return NextResponse.json({ error: 'creator_id required' }, { status: 400 })
  }
  if (creator_id === user.id) {
    return NextResponse.json({ error: '自分自身はフォローできません' }, { status: 400 })
  }

  // 対象が実在し、creator/admin であることを検証
  // （任意の role='user' を follow できてしまう問題への対応）
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', creator_id)
    .maybeSingle()
  if (!target || (target.role !== 'creator' && target.role !== 'admin')) {
    return NextResponse.json({ error: 'creator_not_found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, creator_id })

  if (error) {
    // ユニーク制約違反 = 既にフォロー済み
    if (error.code === '23505') return NextResponse.json({ followed: true, already: true })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // クリエイターへ通知。follow自体は上で成立済みなので、ここで例外を出して500にしない
  // （.single()→.maybeSingle()）。通知insertのerrorも握り潰さずログに残す。
  const { data: follower } = await supabase.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle()
  const admin = createAdminClient()
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: creator_id,
    type: 'follow',
    title: '新しいフォロワー',
    body: `${follower?.display_name ?? 'ファン'} さんがあなたをフォローしました`,
    link: follower?.username ? `/creator/${follower.username}` : '/creator/dashboard',
  })
  if (notifErr) console.error('[follow] notification insert failed:', notifErr.message, 'creator:', creator_id)

  return NextResponse.json({ followed: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `follow:${user.id}`, limit: 60, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { creator_id } = await req.json().catch(() => ({}))
  if (!creator_id || !UUID_RE.test(creator_id)) {
    return NextResponse.json({ error: 'creator_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('creator_id', creator_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ followed: false })
}
