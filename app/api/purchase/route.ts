import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { cleanEnv } from '@/lib/config'

// apiVersion を明示固定（SDK更新時の挙動変化で決済不整合になるのを防ぐ）
const stripe = new Stripe(cleanEnv(process.env.STRIPE_SECRET_KEY), { apiVersion: '2026-03-25.dahlia' })

// purchases の書き込み（insert/update）は RLS 上 Service Role に限定されているため、
// サーバー側で認可済みの purchase レコード操作には admin クライアントを使う。
const admin = createAdminClient()

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    // v49: このルートは lib/auth.ts の requireUser() を経由せず自前で認証しているため、
    // 凍結・退会済みアカウントによる購入がここでは一切ブロックされていなかった
    // （proxy.ts の凍結ゲートは matcher で /api を除外している）。
    // is_suspended/deleted_at は列単位REVOKE対象のPII列のため my_auth_gate_info() RPC で取得する。
    const { data: buyerGateRows, error: buyerGateErr } = await supabase.rpc('my_auth_gate_info')
    const buyerGate = buyerGateRows?.[0] ?? null
    // v49再修正: RPCエラーを握り潰すと「凍結でないと断定できない」のに購入が通る fail-open に
    // なっていた（同ファイルのクリエイター側チェック/creator_blocksは fail-closed なのに不整合）。
    if (buyerGateErr) {
      console.error('[purchase] buyer gate lookup failed (fail-closed):', buyerGateErr.message)
      return NextResponse.json({ error: 'システムエラーが発生しました。時間をおいて再度お試しください' }, { status: 503 })
    }
    if (buyerGate?.is_suspended) {
      return NextResponse.json({ error: 'account_suspended', message: 'このアカウントは現在ご利用いただけません' }, { status: 403 })
    }
    if (buyerGate?.deleted_at) {
      return NextResponse.json({ error: 'account_deleted', message: 'このアカウントは退会処理中です' }, { status: 403 })
    }

    // レート制限: 1ユーザーあたり 10req/分
    const rl = await rateLimit({ key: `purchase:${user.id}`, limit: 30, windowSec: 60 })
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
      .neq('review_status', 'rejected')
      .single()
    if (contentError || !content) return NextResponse.json({ error: 'コンテンツが見つかりません' }, { status: 404 })

    // v49: 凍結・退会済みクリエイターのコンテンツが購入可能なまま放置されていた
    // （proxy.ts はクリエイター本人のダッシュボードアクセスを止めるだけで、
    // 他ユーザーからの購入導線には一切影響しない）。creator_id の is_suspended/
    // deleted_at は他人の行のPII列のため service_role(admin) で読む。
    const { data: creatorStatus, error: creatorStatusErr } = await admin
      .from('profiles')
      .select('is_suspended, deleted_at')
      .eq('id', content.creator_id)
      .maybeSingle()
    if (creatorStatusErr) {
      console.error('[purchase] creator status check failed (fail-closed):', creatorStatusErr.message)
      return NextResponse.json({ error: 'システムエラーが発生しました。時間をおいて再度お試しください' }, { status: 503 })
    }
    if (creatorStatus?.is_suspended || creatorStatus?.deleted_at) {
      return NextResponse.json({ error: 'このクリエイターのコンテンツは現在購入できません' }, { status: 403 })
    }

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

    // 重複購入チェック（completed / refunded を弾く）。
    // refunded を含めるのは、返金後の再購入が後段の upsert で過去の refunded 行を
    // status:'pending' に巻き戻し、返金履歴（会計・係争の証跡）を破壊するのを防ぐため。
    // 再購入が必要なケースは窓口対応とする（purchases が (user_id,content_id) ユニークで
    // 履歴を1行しか保持できない設計のため、行の使い回しを止める）。
    const { data: existing } = await supabase
      .from('purchases')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .in('status', ['completed', 'refunded'])
      .maybeSingle()
    if (existing) {
      if (existing.status === 'refunded') {
        return NextResponse.json(
          { error: 'このコンテンツは返金済みです。再度のご購入をご希望の場合はお問い合わせください' },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: '既に購入済みです' }, { status: 400 })
    }

    // 二重 Checkout 抑止: 直近(5分以内)の pending 行があれば「処理中」を返す。
    // purchase 行は (user_id, content_id) ユニークで1本しか持てないため、並列タブ/二重クリックで
    // 2つ目の Checkout を作ると、後段の upsert が1つ目の stripe_payment_intent_id(session.id) を
    // 上書きしてしまう。すると1つ目で決済完了した webhook が逆引き不能になり「課金済み・記録なし」が
    // 発生する。in-flight の pending がある間は新規 Checkout を作らせないことで session.id 上書きを防ぐ。
    const { data: pendingRow } = await admin
      .from('purchases')
      .select('id, created_at, stripe_payment_intent_id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('status', 'pending')
      .maybeSingle()
    if (pendingRow) {
      const ageMs = Date.now() - new Date(pendingRow.created_at).getTime()
      if (ageMs < 5 * 60 * 1000) {
        return NextResponse.json(
          { error: '購入処理中です。少し時間をおいてから再度お試しください' },
          { status: 409 },
        )
      }
      // 5分経過後は新規Checkoutの作成を許可するが、下の upsert が
      // stripe_payment_intent_id を新セッションIDで上書きすると旧セッションが
      // 参照不能なまま最大24時間支払い可能な状態で残ってしまう（孤児化＝課金されても
      // 購入記録に反映されない/理論上の二重課金）。新規作成前に旧セッションを明示的に
      // 失効させる（cs_ で始まる = まだ session.id のまま。pi_ 保存済みなら
      // 決済がある程度進行しているため expire を試みず、そのまま新規作成に進む）。
      if (pendingRow.stripe_payment_intent_id?.startsWith('cs_')) {
        try {
          await stripe.checkout.sessions.expire(pendingRow.stripe_payment_intent_id)
        } catch (e) {
          console.warn('[purchase] failed to expire stale checkout session (may already be expired/completed):', e)
        }
      }
    }

    // クーポン検証 & 割引計算
    let discountAmount = 0
    let appliedCouponId: string | null = null

    if (couponCode && typeof couponCode === 'string') {
      // v49: coupons_select RLS を owner/admin 限定に絞ったため、購入時のクーポン照会は
      // service_role(admin) で行う（購入者は他人/汎用クーポンの行を直接読めない）。
      const { data: coupon } = await admin
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
        } else {
          return NextResponse.json(
            { error: 'クーポンの適用に失敗しました。有効期限切れまたは使用上限に達した可能性があります' },
            { status: 400 },
          )
        }
      } else {
        return NextResponse.json(
          { error: 'クーポンの適用に失敗しました。有効期限切れまたは使用上限に達した可能性があります' },
          { status: 400 },
        )
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
      // ⭐️ v30: クーポン消費(CAS)と購入レコード確定を1つのDB関数(complete_free_purchase)で
      //   原子的に行う。以前は「クーポン消費 → 別リクエストでupsert」の2ステップで、
      //   upsertが失敗するとクーポンだけ消費済みで購入が成立しない不整合が起き得た。
      //   1つの関数呼び出しに閉じ込めることで、途中失敗時は全体がロールバックされる。
      const stripePaymentIntentId = `free_${user.id}_${contentId}_${Date.now()}`
      const { data: freeOk, error: freeErr } = await admin.rpc('complete_free_purchase', {
        p_user_id: user.id,
        p_content_id: contentId,
        p_coupon_id: appliedCouponId,
        p_original_amount: content.price,
        p_discount_amount: discountAmount,
        p_stripe_payment_intent_id: stripePaymentIntentId,
      })
      if (freeErr) {
        console.error('[purchase] complete_free_purchase failed:', freeErr.message)
        return NextResponse.json({ error: '購入処理に失敗しました。時間をおいて再度お試しください' }, { status: 500 })
      }
      if (freeOk === false) {
        // クーポン上限到達（100%off クーポンの無料取得の抜け道になるため購入を弾く）
        return NextResponse.json({ error: 'クーポンが使用上限に達しました' }, { status: 400 })
      }

      // sold_count 更新（admin: contents更新はcreator/admin限定のため）。
      // v27でCAS化: stock_limit超過なら false。無料経路の超過は監査ログで可視化。
      const { data: scOk, error: scErr } = await admin.rpc('increment_sold_count', { content_id: contentId })
      if (scErr) console.warn('[purchase] free increment_sold_count failed:', scErr.message)
      else if (scOk === false) console.error('[purchase] free OVERSTOCK: 在庫上限超過。content:', contentId, 'user:', user.id)

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
      // Stripeのデフォルト24時間有効を短縮（孤児セッションが長時間支払い可能なままになるのを防ぐ）。
      // 30分はStripeが許容する最短値だが、ここでの Date.now() 取得から実際に
      // Stripe側でセッションが作成されるまでのネットワーク遅延（数百ms〜）があるため、
      // ぴったり30分だと「作成時刻からの30分未満」判定でStripeにINVALID_REQUESTとして
      // 拒否されることがある（実際に発生・再現済み）。安全マージンを載せて35分にする。
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
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
