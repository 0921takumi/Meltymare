import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // プロフィール関連を削除（購入履歴は会計・法令保持のため残す）
  await admin.from('follows').delete().or(`follower_id.eq.${user.id},creator_id.eq.${user.id}`)
  await admin.from('requests').delete().eq('user_id', user.id)
  await admin.from('profiles').delete().eq('id', user.id)

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
