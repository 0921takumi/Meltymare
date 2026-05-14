import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json().catch(() => ({}))
  const { invite_code_id, user_id } = body
  if (!invite_code_id || !user_id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  // 使用記録
  await supabase.from('invite_redemptions').insert({ invite_code_id, user_id }).select().single()

  // カウント増分
  const { data: invite } = await supabase.from('invite_codes').select('used_count').eq('id', invite_code_id).single()
  if (invite) {
    await supabase.from('invite_codes').update({ used_count: invite.used_count + 1 }).eq('id', invite_code_id)
  }
  return NextResponse.json({ ok: true })
}
