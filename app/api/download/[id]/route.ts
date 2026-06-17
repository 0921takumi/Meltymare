import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `download:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // 購入レコードを検証（自分の購入かつ納品済み）
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('id, user_id, delivery_status, delivered_file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('delivery_status', 'delivered')
    .maybeSingle()

  // DB 障害を「購入なし(404)」と誤魔化さない。障害は 503 で表面化させ、運用が
  // 「お金を払ったのにDLできない」を障害として検知できるようにする（サイレント劣化防止）。
  if (purchaseError) {
    console.error('[download] purchase lookup failed:', purchaseError.message, 'purchase_id:', id, 'user:', user.id)
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  if (!purchase || !purchase.delivered_file_url) {
    return NextResponse.json({ error: 'Not found or not yet delivered' }, { status: 404 })
  }

  // 署名URLの有効期限。大容量動画でもDL完了まで失効しないよう 3600 秒（1時間）を確保
  // （商品詳細ページの配信URL発行と同値に統一）。
  const { data: urlData } = await supabase.storage
    .from('deliveries')
    .createSignedUrl(purchase.delivered_file_url, 3600, { download: true })

  if (!urlData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  const res = NextResponse.redirect(urlData.signedUrl)
  // ダウンロードURLをブラウザ/プロキシにキャッシュさせない
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}
