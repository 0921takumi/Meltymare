import { NextRequest, NextResponse } from 'next/server'
import { sendDeliveryEmail } from '@/app/api/webhook/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

// 納品完了メール送信エンドポイント。
// 納品を行ったクリエイター本人のみ呼び出し可とし、任意の purchase_id での送信を防ぐ。
export async function POST(req: NextRequest) {
  // ── 認可・検証フェーズ ──
  // 例外を握り潰さない（認可前の予期せぬ例外まで成功扱いになるのを防ぐ）。
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `notify:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const purchase_id = body?.purchase_id
  if (!purchase_id || typeof purchase_id !== 'string' || !UUID_RE.test(purchase_id)) {
    return NextResponse.json({ error: 'purchase_id required' }, { status: 400 })
  }

  // 所有権チェック: クリエイターが納品したコンテンツに紐づく purchase のみ
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, user_id, delivery_status, delivered_file_url, content:contents(title, creator_id)')
    .eq('id', purchase_id)
    .maybeSingle()
  const content = purchase?.content as { title?: string; creator_id?: string } | null
  const creatorId = content?.creator_id
  if (!purchase || creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 実際に納品済みであることを必須化（「メール届くがDLできない」の信用毀損防止）
  if (purchase.delivery_status !== 'delivered' || !purchase.delivered_file_url) {
    return NextResponse.json({ error: 'まだ納品されていません' }, { status: 400 })
  }

  // ── 副作用フェーズ（メール送信・通知挿入）──
  // 納品DB確定後の付随処理。失敗してもDBは確定済みなので 200 を返すが、
  // 認可・検証の例外（上記）まで握り潰さないよう try はこの範囲に限定する。
  try {
    await sendDeliveryEmail(purchase_id)

    const admin = createAdminClient()
    await admin.from('notifications').insert({
      user_id: purchase.user_id,
      type: 'delivery',
      title: 'コンテンツが納品されました',
      body: `${content?.title ?? 'コンテンツ'} が届きました`,
      link: '/mypage',
    })
  } catch (e) {
    console.error('[notify/delivery] email/notification failed:', e)
    // メール/通知の失敗はDB確定に影響しないため成功扱い（ログは残す）
  }

  return NextResponse.json({ ok: true })
}
