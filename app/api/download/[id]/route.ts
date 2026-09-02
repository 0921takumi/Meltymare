import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 依頼で発覚: ダウンロードが遅いという報告の一因。レート制限チェックと購入レコード
  // 検証は互いに無関係なのに直列(await→await)で行っており、リダイレクト発行前に
  // 無駄な待ち時間が積み重なっていた。並行して実行する。
  const [rl, { data: purchase, error: purchaseError }] = await Promise.all([
    rateLimit({ key: `download:${user.id}`, limit: 30, windowSec: 60 }),
    supabase
      .from('purchases')
      .select('id, user_id, content_id, delivery_status, delivered_file_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('delivery_status', 'delivered')
      .maybeSingle(),
  ])
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // DB 障害を「購入なし(404)」と誤魔化さない。障害は 503 で表面化させ、運用が
  // 「お金を払ったのにDLできない」を障害として検知できるようにする（サイレント劣化防止）。
  if (purchaseError) {
    console.error('[download] purchase lookup failed:', purchaseError.message, 'purchase_id:', id, 'user:', user.id)
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  if (!purchase || !purchase.delivered_file_url) {
    return NextResponse.json({ error: 'Not found or not yet delivered' }, { status: 404 })
  }

  // v57: 法令違反による配信停止は、購入済みであっても配信してはならない。
  // 通常の却下(rejected)は購入者の既得の対価なのでDLを止めない。両者を区別する。
  // 状態はクリエイター側から書き換えられない列なので service_role で読む。
  const { data: contentState, error: contentStateErr } = await createAdminClient()
    .from('contents')
    .select('hard_takedown, takedown_reason')
    .eq('id', purchase.content_id)
    .maybeSingle()
  if (contentStateErr) {
    // v57のマイグレーション未適用（列が無い）だけは例外扱いにする。ここを一律 fail-closed に
    // すると、SQL適用前にデプロイした瞬間に全ユーザーのダウンロードが止まるため。
    // それ以外の障害は「停止中か確認できないまま配信する」ことになるので fail-closed。
    const columnMissing = contentStateErr.code === '42703'
      || /column .*hard_takedown.* does not exist/i.test(contentStateErr.message ?? '')
    if (!columnMissing) {
      console.error('[download] takedown check failed:', contentStateErr.message, 'purchase:', id)
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
    }
    console.warn('[download] hard_takedown 列が未適用です。v57 マイグレーションを実行してください。')
  }
  if (contentState?.hard_takedown) {
    return NextResponse.json({
      error: 'content_taken_down',
      message: 'この商品は運営により配信を停止しました。ご購入分の取り扱いについては運営までお問い合わせください。',
    }, { status: 403 })
  }

  // 署名URLの有効期限。大容量動画でもDL完了まで失効しないよう 3600 秒（1時間）を確保
  // （商品詳細ページの配信URL発行と同値に統一）。
  const { data: urlData, error: signErr } = await supabase.storage
    .from('deliveries')
    .createSignedUrl(purchase.delivered_file_url, 3600, { download: true })

  if (signErr || !urlData?.signedUrl) {
    console.error('[download] createSignedUrl failed:', signErr?.message)
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  const res = NextResponse.redirect(urlData.signedUrl)
  // ダウンロードURLをブラウザ/プロキシにキャッシュさせない
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}
