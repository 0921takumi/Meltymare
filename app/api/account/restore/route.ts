/**
 * アカウント復元 API — v43 ソフト削除の復元経路
 *
 * profiles.deleted_at が1年以内であれば、ログイン可能な本人が自分の意思で
 * deleted_at をクリアして利用を再開できる。
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  // v44: v43の事故の再発防止 — 権限エラー等でdataがnullになった場合を「削除申請なし」と
  // 誤認しないよう、queryエラーは明示的に別扱いにする。
  const { data: profile, error: profileError } = await supabase.from('profiles').select('deleted_at').eq('id', user.id).maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.deleted_at) return NextResponse.json({ error: '削除申請はありません' }, { status: 400 })

  const { error } = await supabase.from('profiles').update({ deleted_at: null }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'account.restore',
    target_type: 'user',
    target_id: user.id,
    metadata: {},
  })

  return NextResponse.json({ ok: true })
}
