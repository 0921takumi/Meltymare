/**
 * ID(username) 変更（本人）
 *
 * 背景: signup時のusernameがemail由来で個人情報を公開していた問題（v52）を受けて、
 * 本人がいつでもランダムな初期IDから好きなIDに変更できるようにする。
 *
 * セキュリティ設計:
 *   - requireUser() で認証必須（凍結/削除アカウントも弾く）
 *   - レート制限（1日5回まで。頻繁な変更による混乱・なりすまし紛いの乗っ取り演出を抑止）
 *   - フォーマット検証・予約語ブロック（lib/username.ts）
 *   - 大文字小文字を無視した重複チェック（事前チェック＋DBのunique制約が最終防波堤）
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { usernameFormatError } from '@/lib/username'

export async function PATCH(req: Request) {
  const ctx = await requireUser()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const rl = await rateLimit({ key: `username-change:${user.id}`, limit: 5, windowSec: 86400 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', message: '本日のID変更回数の上限に達しました。また明日お試しください。' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const username = String(body?.username ?? '').trim().toLowerCase()

  const formatErr = usernameFormatError(username)
  if (formatErr) return NextResponse.json({ error: 'invalid_format', message: formatErr }, { status: 400 })

  const { data: current } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
  if (current?.username === username) {
    return NextResponse.json({ ok: true, username })
  }

  const { data: taken } = await supabase.from('profiles').select('id').ilike('username', username).maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'username_taken', message: 'このIDは既に使われています。' }, { status: 409 })
  }

  const { error: updateErr } = await supabase.from('profiles').update({ username }).eq('id', user.id)
  if (updateErr) {
    // 23505 = unique_violation（事前チェックとの間の競合。ごく稀）
    if ((updateErr as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'username_taken', message: 'このIDは既に使われています。' }, { status: 409 })
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, username })
}
