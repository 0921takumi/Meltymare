import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { FEATURES } from '@/lib/config'

// Next.js 16: middleware → proxy に改称。
// 役割:
//  1) Supabase セッションの維持
//  2) 保護ルートの認可（/admin, /creator, /mypage）
//  3) セキュリティヘッダの付与

const PROTECTED_PREFIXES = ['/admin', '/mypage', '/purchase/success']
// 注意: '/creator' で前方一致すると公開ページ（/creators 一覧・/creator/[username]
// プロフィール）まで巻き込んでしまう。保護対象はクリエイター専用ダッシュボードのみを明示列挙する。
const CREATOR_PREFIXES = [
  '/creator/dashboard', '/creator/upload', '/creator/orders', '/creator/coupons',
  '/creator/plans', '/creator/stories', '/creator/live', '/creator/requests',
  '/creator/blocks', '/creator/polls',
]

// クリエイター申請（本人確認して出品申請する）ページ。ログインは必須だが、対象者は
// 「まだ creator ではない」一般ユーザーそのものなので、CREATOR_PREFIXES の
// 「既に creator/admin でなければ弾く」ロールゲートには含めない。
// 🔴 実際に起きた事故: これを CREATOR_PREFIXES に含めていたため、一般ユーザーが
//    Header の「クリエイターになる」を押しても /contents へ差し戻されるだけで
//    エラー表示もなく、クリエイター申請そのものができなかった
//    （app/creator/verification/page.tsx は role==='user'||'creator' を許可する
//    設計なのに、その手前の proxy でより厳しいロールゲートに引っかかっていた）。
const ONBOARDING_PREFIXES = ['/creator/verification']

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
  const needsCreator = CREATOR_PREFIXES.some(p => pathname.startsWith(p))
  const needsOnboarding = ONBOARDING_PREFIXES.some(p => pathname.startsWith(p))

  // 認証が要るのは: 保護プレフィックス（/admin 含む）+ クリエイター専用ダッシュボード + クリエイター申請ページ
  // （申請ページはログイン必須だがロールゲートは無し）
  const needsAuth = needsCreator || needsOnboarding || PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // v43/v45: ソフト削除済み(退会申請済み)・凍結済みのアカウントは、専用ページ以外への
  // アクセスをすべて止める。role チェックと同じタイミングで1回のRPCにまとめて取得する
  // （ページごとのDB往復を増やさないため）。
  // v45: is_suspended/suspended_reason は v22 の列単位REVOKE対象のPII列で、生の
  // .from('profiles').select(...) では authenticated から読めない
  // （v43のdeleted_at事故と同じ罠）。auth.uid()自身の分だけを返す
  // my_auth_gate_info() RPC経由で取得し、他人の凍結理由が漏れないようにする。
  const isRestorePage = pathname === '/auth/restore'
  const isSuspendedPage = pathname === '/auth/suspended'
  // v49: admin/creator のロール再チェックは、Next.js 16 公式ガイド
  // （node_modules/next/dist/docs/01-app/02-guides/authentication.md「Optimistic checks
  // with Proxy」節: 「Proxy は prefetch でも毎回走るため、DB を伴う secure check は避けるべき」）
  // に沿って撤去し、各保護エリアに近い Data Access Layer（app/admin/layout.tsx,
  // app/creator/(gated)/layout.tsx）に一本化した。proxy.ts に残すのは
  // is_suspended/deleted_at のグローバルチェックのみ（ここは特定ページに属さない横断的な
  // 制御で、DAL化する自然な置き場所が無い）。
  const needsProfile = user != null && !isRestorePage
  // v48: v45でこのゲートを全ページに広げた結果、ログイン中のユーザーは全ての画面遷移で
  // DB往復(RPC)が発生するようになり、体感速度が明確に悪化した（実測: 通報あり）。
  // 直近チェック済み(cookie)なら2分間はDB往復をスキップする。凍結/削除の反映が
  // 最大2分遅れる可能性はあるが、全ページ毎回DB往復するコストの方が実害が大きい。
  // v49: ロールチェックをDAL側に移したことで、admin/creator配下も含め常にこの
  // キャッシュが効くようになった（以前は needsRoleCheck で強制バイパスしていた）。
  const GATE_COOKIE = 'mm_gate_ok'
  const gateFresh = user != null && request.cookies.get(GATE_COOKIE)?.value === user.id
  if (user && needsProfile && !gateFresh) {
    const { data: gateRows, error: profileError } = await supabase.rpc('my_auth_gate_info')
    const profile = gateRows?.[0] ?? null

    // v44: v43で発覚した事故の再発防止 — 権限エラー等を「フラグが立っていない」と
    // 誤認してサイレントに通してしまわないよう、エラー時は必ずログに残す（ゲート自体は
    // 落とさない。ここで止めると認証エラーの度に全ユーザーが誤誘導されるため）。
    if (profileError) {
      console.error('[proxy] auth gate info lookup failed:', profileError.message, 'path:', pathname)
    }
    if (profile?.is_suspended && !isSuspendedPage && !pathname.startsWith('/auth/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/suspended'
      return NextResponse.redirect(url)
    }
    if (profile?.deleted_at && !isRestorePage && !pathname.startsWith('/auth/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/restore'
      return NextResponse.redirect(url)
    }

    // チェック通過（凍結/削除いずれでもない）を2分間キャッシュする
    if (!profileError && !profile?.is_suspended && !profile?.deleted_at) {
      response.cookies.set(GATE_COOKIE, user.id, { maxAge: 120, httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
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
