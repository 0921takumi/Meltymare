import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { assertActorNotSuspended, assertTargetCreatorActive } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeOptional } from '@/lib/sanitize'
import { cleanEnv } from '@/lib/config'

// apiVersion を明示固定（SDK更新時の挙動変化で決済不整合になるのを防ぐ）
const stripe = new Stripe(cleanEnv(process.env.STRIPE_SECRET_KEY), { apiVersion: '2026-03-25.dahlia' })

const PRESET_AMOUNTS = [300, 500, 1000, 3000, 5000, 10000]
const MIN_AMOUNT = 100
const MAX_AMOUNT = 100000
const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    // v49: 凍結・退会済みアカウントが直接このAPIで送金できていた穴を塞ぐ
    const suspendedRes = await assertActorNotSuspended(supabase)
    if (suspendedRes) return suspendedRes

    // レート制限: 並列大量決済を防ぐ（金銭直撃のため厳しめ）
    const rl = await rateLimit({ key: `tip:${user.id}`, limit: 20, windowSec: 60 })
    if (!rl.ok) return NextResponse.json({ error: 'リクエストが多すぎます。少し時間をおいてください' }, { status: 429 })

    const { creatorId, amount, message } = await req.json()

    // creatorId: UUID 形式チェック必須（任意文字列で Stripe Session が作られないように）
    if (typeof creatorId !== 'string' || !UUID_RE.test(creatorId)) {
      return NextResponse.json({ error: 'クリエイターIDが不正です' }, { status: 400 })
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount)) {
      return NextResponse.json({ error: '金額が不正です' }, { status: 400 })
    }
    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: `金額は¥${MIN_AMOUNT}〜¥${MAX_AMOUNT}の範囲で指定してください` }, { status: 400 })
    }
    if (user.id === creatorId) {
      return NextResponse.json({ error: '自分自身にチップは送れません' }, { status: 400 })
    }

    // メッセージのサニタイズ（制御文字除去・長さ制限）
    const cleanMessage = sanitizeOptional(message, { maxLength: 200, allowNewlines: true })

    const { data: creator } = await supabase
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', creatorId)
      .eq('role', 'creator')
      .maybeSingle()
    if (!creator) return NextResponse.json({ error: 'クリエイターが見つかりません' }, { status: 404 })

    // v49: 凍結・退会済みクリエイターへの送金を止める（購入側 purchase と同じ threat model。
    // 公開ページは404になるがAPI直叩きは別途塞ぐ必要がある）。
    const creatorRes = await assertTargetCreatorActive(creatorId)
    if (creatorRes) return creatorRes

    // Stripe Checkout の success/cancel_url は invalid URL(末尾 BOM/CRLF 混入)を Stripe 側で
    // 弾かれるため、cleanEnv で必ず正規化してから使う。
    const appUrl = cleanEnv(process.env.NEXT_PUBLIC_APP_URL) || 'https://my-focus.jp'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `${creator.display_name} へのチップ`,
            description: cleanMessage ?? undefined,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/creator/${creatorId}?tip=success`,
      cancel_url: `${appUrl}/creator/${creatorId}?tip=cancel`,
      metadata: {
        tip: '1',
        creator_id: creatorId,
        user_id: user.id,
        tip_amount: String(amount),
        tip_message: cleanMessage ?? '',
      },
    })

    const { error: tipInsertErr } = await supabase.from('tips').insert({
      user_id: user.id,
      creator_id: creatorId,
      amount,
      message: cleanMessage,
      stripe_payment_intent_id: session.payment_intent as string ?? session.id,
      status: 'pending',
    })
    // insert を握り潰さない: 失敗すると「決済されたのに tips 行が無い → webhook が
    // 逆引きできず課金だけ成立」という最悪状態になるため、Checkout URL を返さず 500。
    // （purchase 側と同じ厳格度。Stripe Session は未使用のまま期限切れになり課金されない）
    if (tipInsertErr) {
      console.error('[tip] insert failed:', tipInsertErr)
      return NextResponse.json({ error: 'チップ処理に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'チップ処理に失敗しました' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ presets: PRESET_AMOUNTS, min: MIN_AMOUNT, max: MAX_AMOUNT })
}
