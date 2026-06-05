import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * 出金ステータス変更（管理者専用）
 *
 * 背景: payouts には UPDATE の RLS ポリシーが無く、管理画面からのクライアント直
 *   update は 0 行更新でサイレント失敗していた（出金ステータスが保存されない）。
 *   admin client に集約し、role 確認のうえ更新＋監査ログを残す。
 */

const UUID_RE = /^[0-9a-f-]{36}$/i
const ALLOWED = ['pending', 'processing', 'completed', 'failed']

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
  const payoutId = body?.payout_id
  const status = body?.status
  if (typeof payoutId !== 'string' || !UUID_RE.test(payoutId)) {
    return NextResponse.json({ error: 'invalid_payout' }, { status: 400 })
  }
  if (typeof status !== 'string' || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status }
  if (status === 'completed') update.paid_at = new Date().toISOString()

  const { error } = await admin.from('payouts').update(update).eq('id', payoutId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 監査ログ（service_role で記録）
  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'payout_status_change',
    target_type: 'payout',
    target_id: payoutId,
    detail: { status },
  })

  return NextResponse.json({ ok: true })
}
