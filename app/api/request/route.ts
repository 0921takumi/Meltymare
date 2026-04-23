import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeText, sanitizeOptional } from '@/lib/sanitize'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const UUID_RE = /^[0-9a-f-]{36}$/i
const VALID_STATUS = ['pending', 'accepted', 'rejected', 'completed']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: `request:${user.id}`, limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json()
  if (!body.creator_id || !UUID_RE.test(body.creator_id)) {
    return NextResponse.json({ error: 'Invalid creator_id' }, { status: 400 })
  }
  if (body.creator_id === user.id) {
    return NextResponse.json({ error: '自分にリクエストはできません' }, { status: 400 })
  }
  const message = sanitizeText(body.message, { maxLength: 2000 })
  if (!message) return NextResponse.json({ error: 'メッセージは必須です' }, { status: 400 })

  const budget = body.budget != null ? parseInt(body.budget, 10) : null
  if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 10_000_000)) {
    return NextResponse.json({ error: 'Invalid budget' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('requests')
    .insert({ user_id: user.id, creator_id: body.creator_id, message, budget })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // クリエイターへ通知
  const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  await adminClient().from('notifications').insert({
    user_id: body.creator_id,
    type: 'request',
    title: '新しいリクエスト',
    body: `${sender?.display_name ?? 'ファン'} さんからリクエストが届きました`,
    link: '/creator/requests',
  })

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: `request-patch:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json()
  if (!body.id || !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  if (!VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // creator 本人確認
  const { data: req_ } = await supabase.from('requests').select('creator_id').eq('id', body.id).single()
  if (req_?.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const creator_reply = sanitizeOptional(body.creator_reply, { maxLength: 2000 })

  const { data, error } = await supabase
    .from('requests')
    .update({ status: body.status, creator_reply, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('*, user_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // リクエスト送信者へ通知
  const STATUS_LABEL: Record<string, string> = {
    accepted: '承諾されました',
    rejected: '見送られました',
    completed: '完了しました',
  }
  const label = STATUS_LABEL[body.status]
  if (label && data?.user_id) {
    await adminClient().from('notifications').insert({
      user_id: data.user_id,
      type: 'request',
      title: `リクエストが${label}`,
      body: creator_reply ?? undefined,
      link: '/requests',
    })
  }

  return NextResponse.json(data)
}
