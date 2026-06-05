import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * next パラメータの安全化（オープンリダイレクト対策）。
 * 外部URL・プロトコル相対・schemeへの遷移を全て弾き、内部パスのみ許可する。
 */
function safeNext(raw: string | null): string {
  const fallback = '/contents'
  if (!raw) return fallback
  // / で始まらない / // で始まる(プロトコル相対) / scheme含む は外部誘導の温床
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // スキーム混入('http:', 'javascript:' 等) や CR/LF を含むものは弾く
  if (/^[a-z][a-z0-9+\-.]*:/i.test(raw) || /[\r\n\t]/.test(raw)) return fallback
  // 長さ制限（DoS/誤入力対策）
  if (raw.length > 256) return fallback
  return raw
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const errorParam = url.searchParams.get('error_description')

  const origin = url.origin

  if (errorParam) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(errorParam)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('認証コードが取得できませんでした')}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  // プロフィールが存在しない場合は作成（OAuth初回ログイン時）
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existing) {
      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string }
      const displayName = meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'ユーザー'
      const avatarUrl = meta.avatar_url ?? null

      await supabase.from('profiles').insert({
        id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: 'user',
      })
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
