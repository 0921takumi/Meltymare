import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SERVICE_MODE } from '@/lib/config'

export async function POST(req: Request) {
  // 招待制OFFなら検証スキップ
  if (!SERVICE_MODE.inviteOnly) return NextResponse.json({ ok: true, invite_code_id: null })

  const body = await req.json().catch(() => ({}))
  const code: string | undefined = body.code?.trim().toUpperCase()
  if (!code) return NextResponse.json({ ok: false, error: '招待コードが必要です' }, { status: 400 })

  const supabase = await createClient()
  const { data: invite } = await supabase
    .from('invite_codes')
    .select('id, max_uses, used_count, expires_at, is_active')
    .eq('code', code)
    .maybeSingle()

  if (!invite || !invite.is_active) {
    return NextResponse.json({ ok: false, error: '無効な招待コードです' })
  }
  if (invite.used_count >= invite.max_uses) {
    return NextResponse.json({ ok: false, error: 'この招待コードは使用上限に達しています' })
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'この招待コードは有効期限切れです' })
  }
  return NextResponse.json({ ok: true, invite_code_id: invite.id })
}
