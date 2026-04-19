import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16: middleware → proxy に改称。
// 役割:
//  1) Supabase セッションの維持
//  2) 保護ルートの認可（/admin, /creator, /mypage）
//  3) セキュリティヘッダの付与

const PROTECTED_PREFIXES = ['/admin', '/creator', '/mypage', '/purchase/success']
const ADMIN_PREFIXES = ['/admin']
const CREATOR_PREFIXES = ['/creator']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const needsAuth = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ロールチェック（DB 参照を最小化するため、必要な時だけ）
  const needsAdmin = ADMIN_PREFIXES.some(p => pathname.startsWith(p))
  const needsCreator = CREATOR_PREFIXES.some(p => pathname.startsWith(p))

  if ((needsAdmin || needsCreator) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (needsAdmin && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    if (needsCreator && profile?.role !== 'creator' && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/contents', request.url))
    }
  }

  // セキュリティヘッダ
  setSecurityHeaders(response)

  return response
}

function setSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-DNS-Prefetch-Control', 'off')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")')
  // HSTS は本番 HTTPS のみ
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
