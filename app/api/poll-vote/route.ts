import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID = /^[0-9a-f-]{36}$/i

// 投票（1ユーザー1票・無料）
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const rl = await rateLimit({ key: `poll-vote:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'リクエストが多すぎます' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const pollId = body?.poll_id
  const rawOptionIndex = body?.option_index

  if (typeof pollId !== 'string' || !UUID.test(pollId)) {
    return NextResponse.json({ error: 'invalid_poll' }, { status: 400 })
  }
  // 型ガード: null/undefined/string などが Number() 経由で 0 として通る抜け穴を塞ぐ
  if (typeof rawOptionIndex !== 'number') {
    return NextResponse.json({ error: 'invalid_option' }, { status: 400 })
  }
  const optionIndex = rawOptionIndex
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    return NextResponse.json({ error: 'invalid_option' }, { status: 400 })
  }

  // アンケートの存在・状態・選択肢数を確認（polls は公開SELECT）
  const { data: poll } = await supabase
    .from('polls')
    .select('id, status, options')
    .eq('id', pollId)
    .maybeSingle()
  if (!poll) return NextResponse.json({ error: 'アンケートが見つかりません' }, { status: 404 })
  if (poll.status !== 'open') return NextResponse.json({ error: 'このアンケートは締め切られました' }, { status: 400 })

  const optionCount = Array.isArray(poll.options) ? poll.options.length : 0
  if (optionIndex >= optionCount) {
    return NextResponse.json({ error: 'invalid_option' }, { status: 400 })
  }

  // 投票（RLS で user_id=本人を強制。1人1票はユニーク制約）
  const { error } = await supabase
    .from('poll_votes')
    .insert({ poll_id: pollId, user_id: user.id, option_index: optionIndex })

  if (error) {
    // ユニーク制約違反 = 投票済み
    if (error.code === '23505') {
      return NextResponse.json({ error: 'すでに投票済みです' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
