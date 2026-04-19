import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type Role = 'user' | 'creator' | 'admin'

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  role: Role
}

/** 認証必須 + プロフィール取得。未認証/未登録なら 401 レスポンス返却。 */
export async function requireUser(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })

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
