import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

// apiVersion を明示固定（SDK更新時の挙動変化で決済不整合になるのを防ぐ）
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

// purchases の書き込み（insert/update）は RLS 上 Service Role に限定されているため、
// サーバー側で認可済みの purchase レコード操作には admin クライアントを使う。
const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    // レート制限: 1ユーザーあたり 10req/分
    const rl = await rateLimit({ key: `purchase:${user.id}`, limit: 10, windowSec: 60 })
    if (!rl.ok) return NextResponse.json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください' }, { status: 429 })

    const { contentId, couponCode, tipPercent: rawTipPercent } = await req.json()

    // チップ率のバリデーション（0/5/10/15 のみ許可）
    const tipPercent: 0 | 5 | 10 | 15 = [0, 5, 10, 15].includes(Number(rawTipPercent))
      ? (Number(rawTipPercent) as 0 | 5 | 10 | 15)
      : 0

    // contentId は UUID 形式のみ許可
    if (typeof contentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(contentId)) {
      return NextResponse.json({ error: 'Invalid contentId' }, { status: 400 })
    }

    // コンテンツ取得
    // review_status='approved' のみ購入可能。pending（審査待ち）/ rejected（却下）はブロック。
    // AIモデレーション/admin手動レビューでフラグされたコンテンツが
    // is_published=true のまま放置されていても、購入導線を物理的に閉じる二重防御。
    const { data: content, error: contentError } = await supabase
      .from('contents')
      .select('*')
      .eq('id', contentId)
      .eq('is_published', true)
      .eq('review_status', 'approved')
      .single()
    if (contentError || !content) return NextResponse.json({ error: 'コンテンツが見つかりません' }, { status: 404 })

    // 自分のコンテンツは購入不可
    if (content.creator_id === user.id) {
      return NextResponse.json({ error: '自分のコンテンツは購入できません' }, { status: 400 })
    }

    // ブロックチェック: このクリエイターにブロックされているユーザーは購入不可。
    //   service_role(admin) で creator_blocks を参照（RLS回避）。
    //   v13 適用済み前提で **fail-closed**: クエリ失敗時は購入を止める
    //   （ブロック回避による信用毀損リスクの方が、一時的な購入不可より深刻）。
    //   未知のテーブル(42P01)以外のエラーも同様に fail-closed とする。
    const { data: blockRow, error: blockErr } = await admin
      .from('creator_blocks')
      .select('id')
      .eq('creator_id', content.creator_id)
      .eq('blocked_user_id', user.id)
      .maybeSingle()
    if (blockErr) {
      console.error('[purchase] creator_blocks check failed (fail-closed):', blockErr)
      return NextResponse.json(
        { error: 'システムエラーが発生しました。時間をおいて再度お試しください' },
        { status: 503 },
      )
    }
    if (blockRow) {
      return NextResponse.json({ error: 'このクリエイターのコンテンツは現在購入できません' }, { status: 403 })
    }

    // 在庫チェック
    if (content.stock_limit != null && content.sold_count >= content.stock_limit) {
      return NextResponse.json({ error: 'SOLD OUTです' }, { status: 400 })
    }

    // 重複購入チェック
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('status', 'completed')
      .single()
    if (existing) return NextResponse.json({ error: '既に購入済みです' }, { status: 400 })

    // クーポン検証 & 割引計算
    let discountAmount = 0
    let appliedCouponId: string | null = null

    if (couponCode && typeof couponCode === 'string') {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('is_active', true)
        .single()

      if (coupon) {
        const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
        const isMaxed = coupon.max_uses != null && coupon.used_count >= coupon.max_uses
        const isMinOk = content.price >= (coupon.min_amount ?? 0)
        // クーポンに creator_id が紐付いている場合（=クリエイター個別クーポン）は、
        // 対象コンテンツのクリエイターと一致しなければ無効とする。
        // creator_id が NULL のクーポンはプラットフォーム全体で利用可能。
        const isCreatorOk = !coupon.creator_id || coupon.creator_id === content.creator_id

        if (!isExpired && !isMaxed && isMinOk && isCreatorOk) {
          discountAmount = coupon.discount_type === 'percent'
            ? Math.floor(content.price * coupon.discount_value / 100)
            : coupon.discount_value
          discountAmount = Math.min(discountAmount, content.price)
          appliedCouponId = coupon.id
        }
      }
    }

    const discountedContentPrice = Math.max(content.price - discountAmount, 0)
    // チップは割引後の商品価格に対して計算（Math.floorで切り捨て統一）
    const tipAmount = Math.floor(discountedContentPrice * tipPercent / 100)
    const finalPrice = discountedContentPrice + tipAmount
    // env未設定で success_url=`undefined/...` になり Stripe Checkout が 500 で死ぬのを防ぐ
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp').trim()

    // 無料（割引100% かつ チップなし）の場合は直接完了
    if (finalPrice === 0) {
      // upsert: 過去に pending 行があっても (user_id, content_id) で更新（重複制約回避）
      // 書き込みは admin（Service Role）。RLS で purchases の update が制限されているため。
      const { error: freeErr } = await admin.from('purchases').upsert({
        user_id: user.id,
        content_id: contentId,
        amount: 0,
        content_price: 0,
        tip_amount: 0,
        tip_percent: 0,
        original_amount: content.price,
        discount_amount: discountAmount,
        coupon_id: appliedCouponId,
        // 並列で同時に複数の無料purchaseが作られた際の payment_intent_id 衝突を避ける。
        // (user_id, content_id) ユニーク制約で実質的にレコード自体は重複しないが、
        // stripe_payment_intent_id 側にも index/制約が将来追加されたときの安全側。
        stripe_payment_intent_id: `free_${user.id}_${contentId}_${Date.now()}`,
        status: 'completed',
        delivery_status: 'pending',
      }, { onConflict: 'user_id,content_id' })
      if (freeErr) {
        console.error('[purchase] free upsert failed:', freeErr)
        return NextResponse.json({ error: `購入記録の作成に失敗しました: ${freeErr.message}` }, { status: 500 })
      }

      // クーポン使用回数更新（admin: coupons更新はRLS制限。CAS化された RPC で原子的にインクリメント）
      // v15 以降、戻り値 boolean: false なら max_uses 到達等で増分されなかった。
      // 既に discountAmount は適用済みなので、ここで失敗しても返金はしない（free=¥0なので影響軽微）が、
      // ログには明示残す。
      if (appliedCouponId) {
        const { data: incOk, error: cpErr } = await admin.rpc('increment_coupon_used', { coupon_id: appliedCouponId })
        if (cpErr) console.warn('[purchase] free increment_coupon_used failed:', cpErr.message)
        else if (incOk === false) console.warn('[purchase] free coupon already at max_uses:', appliedCouponId)
      }
      // sold_count 更新（admin: contents更新はcreator/admin限定のため）
      const { error: scErr } = await admin.rpc('increment_sold_count', { content_id: contentId })
      if (scErr) console.warn('[purchase] free increment_sold_count failed:', scErr.message)

      return NextResponse.json({ checkoutUrl: `${appUrl}/purchase/success` })
    }

    // Stripe Checkout Session作成
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: discountAmount > 0
              ? `${content.title}（クーポン適用後）`
              : content.title,
            images: content.thumbnail_url ? [content.thumbnail_url] : [],
          },
          unit_amount: discountedContentPrice,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/purchase/success`,
      cancel_url: `${appUrl}/contents/${contentId}`,
      metadata: {
        content_id: contentId,
        user_id: user.id,
        coupon_id: appliedCouponId ?? '',
        original_amount: String(content.price),
        discount_amount: String(discountAmount),
        tip_amount: String(tipAmount),
        tip_percent: String(tipPercent),
      },
    }

    if (tipAmount > 0) {
      sessionParams.line_items!.push({
        price_data: {
          currency: 'jpy',
          product_data: { name: `応援チップ (${tipPercent}%)` },
          unit_amount: tipAmount,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // purchase レコードを作成。**エラーを握りつぶさない**：
    //   ここで失敗すると「決済はできたが購入記録がない」という最悪状態になるため、
    //   失敗したら 500 を返して決済導線に進ませない。
    //   upsert: (user_id, content_id) のユニーク制約があるため、過去の pending 行を
    //   新しいセッション情報で更新する（リトライ・再購入導線に対応）。
    const { error: insertErr } = await admin.from('purchases').upsert({
      user_id: user.id,
      content_id: contentId,
      amount: finalPrice,
      content_price: discountedContentPrice,
      tip_amount: tipAmount,
      tip_percent: tipPercent,
      original_amount: content.price,
      discount_amount: discountAmount,
      coupon_id: appliedCouponId,
      stripe_payment_intent_id: session.payment_intent as string ?? session.id,
      status: 'pending',
    }, { onConflict: 'user_id,content_id' })
    if (insertErr) {
      console.error('[purchase] upsert failed:', insertErr)
      return NextResponse.json({ error: `購入記録の作成に失敗しました: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url })
  } catch (e: unknown) {
    console.error('purchase error:', e)
    return NextResponse.json({ error: '購入処理に失敗しました' }, { status: 500 })
  }
}
