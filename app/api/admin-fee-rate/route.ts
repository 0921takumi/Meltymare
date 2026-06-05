import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * クリエイター手数料率の変更（管理者専用）
 *
 * 背景: profiles の UPDATE は本人(auth.uid()=id)限定の RLS のため、管理者が
 *   他人(クリエイター)の fee_rate をクライアント直 update すると 0 行更新で
 *   サイレント失敗していた。admin client に集約し、role 確認＋監査ログを残す。
 */

const UUID_RE = /^[0-9a-f-]{36}$/i

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const creatorId = body?.creator_id
  const feeRate = body?.fee_rate
  if (typeof creatorId !== 'string' || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ error: 'invalid_creator' }, { status: 400 })
  }
  if (typeof feeRate !== 'number' || !Number.isInteger(feeRate) || feeRate < 0 || feeRate > 100) {
    return NextResponse.json({ error: 'invalid_rate' }, { status: 400 })
  }

  const { error } = await admin.from('profiles').update({ fee_rate: feeRate }).eq('id', creatorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'fee_rate_change',
    target_type: 'profile',
    target_id: creatorId,
    detail: { fee_rate: feeRate },
  })

  return NextResponse.json({ ok: true })
}
