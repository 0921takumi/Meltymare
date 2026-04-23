import { NextRequest, NextResponse } from 'next/server'
import { sendDeliveryEmail } from '@/app/api/webhook/route'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

// 納品完了メール送信エンドポイント。
// 納品を行ったクリエイター本人のみ呼び出し可とし、任意の purchase_id での送信を防ぐ。
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = rateLimit({ key: `notify:${user.id}`, limit: 30, windowSec: 60 })
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { purchase_id } = await req.json()
    if (!purchase_id || !UUID_RE.test(purchase_id)) {
      return NextResponse.json({ error: 'purchase_id required' }, { status: 400 })
    }

    // 所有権チェック: クリエイターが納品したコンテンツに紐づく purchase のみ
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id, user_id, content:contents(title, creator_id)')
      .eq('id', purchase_id)
      .single()
    const content = purchase?.content as { title?: string; creator_id?: string } | null
    const creatorId = content?.creator_id
    if (!purchase || creatorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await sendDeliveryEmail(purchase_id)

    // 購入者へ納品完了通知
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await admin.from('notifications').insert({
      user_id: purchase.user_id,
      type: 'delivery',
      title: 'コンテンツが納品されました',
      body: `${content?.title ?? 'コンテンツ'} が届きました`,
      link: '/mypage',
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ ok: true }) // メール送信失敗時もDBは確定済みなので握りつぶす
  }
}
