import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/contents'
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
      const displayName =
        (user.user_metadata as any)?.full_name ??
        (user.user_metadata as any)?.name ??
        (user.email?.split('@')[0]) ??
        'ユーザー'
      const avatarUrl = (user.user_metadata as any)?.avatar_url ?? null

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
