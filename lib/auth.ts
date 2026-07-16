import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type Role = 'user' | 'creator' | 'admin'

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  role: Role
}

/**
 * 認証必須 + プロフィール取得。未認証/未登録なら 401 レスポンス返却。
 *
 * v49: これまでここは role だけを見ており、is_suspended/deleted_at を一切
 * 確認していなかった。requireUser/requireRole/requireCreator/requireAdmin は
 * 13以上のAPIルートの共通チョークポイントで、proxy.ts の凍結/削除ゲートは
 * matcher が /api を除外しているため（各ルートが自前で認可する設計）ここを
 * 通らない — つまり凍結・退会済みアカウントでも各APIを直接叩けてしまっていた。
 * is_suspended/deleted_at は v22 の列単位REVOKE対象のPII列で生の
 * .from('profiles').select(...) では読めないため、my_auth_gate_info() RPC
 * (v45, auth.uid()自身の分だけを返す) を使う。
 */
export async function requireUser(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: gateRows, error: profileError } = await supabase.rpc('my_auth_gate_info')
  const profile = gateRows?.[0] ?? null

  if (profileError) {
    console.error('[auth] profile fetch failed:', profileError.message, 'user:', user.id)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })

  if (profile.is_suspended) {
    return NextResponse.json({ error: 'account_suspended', message: 'このアカウントは現在ご利用いただけません' }, { status: 403 })
  }
  if (profile.deleted_at) {
    return NextResponse.json({ error: 'account_deleted', message: 'このアカウントは退会処理中です' }, { status: 403 })
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    role: profile.role as Role,
  }
}

/** ロール制限付き。unauthorized/forbidden レスポンスを返す。 */
export async function requireRole(allowed: Role[]): Promise<AuthContext | NextResponse> {
  const ctx = await requireUser()
  if (ctx instanceof NextResponse) return ctx
  if (!allowed.includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return ctx
}

export const requireAdmin = () => requireRole(['admin'])
export const requireCreator = () => requireRole(['creator', 'admin'])
