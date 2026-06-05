import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'

const UUID = /^[0-9a-f-]{36}$/i

async function authCreator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') {
    return { ok: false as const, res: NextResponse.json({ error: 'creator_only' }, { status: 403 }) }
  }
  return { ok: true as const, supabase, userId: user.id }
}

// アンケート作成
export async function POST(req: Request) {
  const auth = await authCreator()
  if (!auth.ok) return auth.res

  const rl = await rateLimit({ key: `poll:${auth.userId}`, limit: 20, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'リクエストが多すぎます' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const question = sanitizeText(body?.question, { maxLength: 200, allowNewlines: false })
  if (!question) return NextResponse.json({ error: '質問を入力してください' }, { status: 400 })

  if (!Array.isArray(body?.options)) {
    return NextResponse.json({ error: '選択肢が不正です' }, { status: 400 })
  }
  const options = body.options
    .map((o: unknown) => sanitizeText(o, { maxLength: 80, allowNewlines: false }))
    .filter((o: string) => o.length > 0)
  if (options.length < 2 || options.length > 4) {
    return NextResponse.json({ error: '選択肢は2〜4個にしてください' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('polls')
    .insert({ creator_id: auth.userId, question, options })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

// 締切 / 再開
export async function PATCH(req: Request) {
  const auth = await authCreator()
  if (!auth.ok) return auth.res

  const body = await req.json().catch(() => ({}))
  if (typeof body?.id !== 'string' || !UUID.test(body.id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  if (body?.status !== 'open' && body?.status !== 'closed') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('polls')
    .update({ status: body.status })
    .eq('id', body.id)
    .eq('creator_id', auth.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// 削除
export async function DELETE(req: Request) {
  const auth = await authCreator()
  if (!auth.ok) return auth.res

  const body = await req.json().catch(() => ({}))
  if (typeof body?.id !== 'string' || !UUID.test(body.id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('polls')
    .delete()
    .eq('id', body.id)
    .eq('creator_id', auth.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
