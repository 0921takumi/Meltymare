import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { FEATURES } from '@/lib/config'

// Next.js 16: middleware → proxy に改称。
// 役割:
//  1) Supabase セッションの維持
//  2) 保護ルートの認可（/admin, /creator, /mypage）
//  3) セキュリティヘッダの付与

const PROTECTED_PREFIXES = ['/admin', '/mypage', '/purchase/success']
const ADMIN_PREFIXES = ['/admin']
// 注意: '/creator' で前方一致すると公開ページ（/creators 一覧・/creator/[username]
// プロフィール）まで巻き込んでしまう。保護対象はクリエイター専用ダッシュボードのみを明示列挙する。
const CREATOR_PREFIXES = [
  '/creator/dashboard', '/creator/upload', '/creator/orders', '/creator/coupons',
  '/creator/plans', '/creator/stories', '/creator/live', '/creator/requests',
  '/creator/verification', '/creator/blocks', '/creator/polls',
]

// 機能フラグで停止中の機能のルート。アクセスされたらトップへリダイレクトする。
const DISABLED_PREFIXES: string[] = [
  ...(FEATURES.stories ? [] : ['/stories', '/creator/stories']),
  ...(FEATURES.live ? [] : ['/live', '/creator/live']),
  ...(FEATURES.auctions ? [] : ['/auctions']),
  // サブスクは Stripe Subscription 未統合のため Phase 2 送り
  ...(FEATURES.subscriptions ? [] : ['/mypage/subscriptions', '/creator/plans']),
]

// 旧ルート → 新ルートへの恒久リダイレクト（リクエスト機能 → アンケート機能）
const REDIRECT_MAP: Record<string, string> = {
  '/requests': '/polls',
  '/requests/new': '/polls',
  '/creator/requests': '/creator/polls',
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 停止中の機能（ストーリーズ／ライブ等）は認可チェックの前にトップへ退避
  if (DISABLED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 旧リクエスト系ルートはアンケートへ恒久リダイレクト
  if (REDIRECT_MAP[pathname]) {
    return NextResponse.redirect(new URL(REDIRECT_MAP[pathname], request.url))
  }

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

  // ロールチェック対象（DB 参照を最小化するため、必要な時だけ）
  const needsAdmin = ADMIN_PREFIXES.some(p => pathname.startsWith(p))
  const needsCreator = CREATOR_PREFIXES.some(p => pathname.startsWith(p))

  // 認証が要るのは: 保護プレフィックス + クリエイター専用ダッシュボード
  const needsAuth = needsCreator || PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if ((needsAdmin || needsCreator) && user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // profile 行が無い/取得失敗時は保護ルートへ通さない。
    //  - error: DB 障害等。握り潰すとサイレント劣化するので必ずログに残す。
    //  - !profile: プロフィール未作成ユーザー（トリガー取りこぼし等）。.single() だと
    //    0 行で例外→500 になるため .maybeSingle() で null を明示的に扱う。
    if (profileError) {
      console.error('[proxy] profile lookup failed:', profileError.message, 'path:', pathname)
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (!profile) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (needsAdmin && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    if (needsCreator && profile.role !== 'creator' && profile.role !== 'admin') {
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
  // api は各ルートが自前で createClient(認証)・requireX(認可) するため proxy を通さない
  // （無駄な Supabase セッション往復を避ける）。認可の正は各 API・layout・page 側にある。
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
