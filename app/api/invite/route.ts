import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = 'MYF-'
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { note, max_uses, days } = body
  const expires_at = days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString() : null

  // ユニークコード生成 (10回リトライ)
  let code = generateCode()
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabase.from('invite_codes').select('id').eq('code', code).maybeSingle()
    if (!existing) break
    code = generateCode()
  }

  const { data: invite, error } = await supabase
    .from('invite_codes')
    .insert({
      code,
      note: note ?? null,
      max_uses: Math.max(1, Math.min(100, Number(max_uses) || 1)),
      expires_at,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'invite_create',
    target_type: 'invite_code',
    target_id: invite.id,
    detail: { code, note },
  })

  return NextResponse.json({ ok: true, invite })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, is_active } = body
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  await supabase.from('invite_codes').update({ is_active }).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  await supabase.from('invite_codes').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
