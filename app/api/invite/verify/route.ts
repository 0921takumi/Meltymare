/**
 * 招待コード検証 API
 *
 * セキュリティ設計:
 *   - レート制限（5req/分）— 招待コードの brute force を防止。
 *     32^6 ≈ 10億通りなので、5req/分でもサンプリング攻撃は不可能（数百年スパン）。
 *   - エラーメッセージは「無効な招待コード」で統一し、存在/期限切れ/上限到達等を
 *     区別させない（情報漏洩防止）。
 *   - 認証不要（サインアップ前にも呼ばれる）だが、IP ベースの rate limit を適用。
 *
 * 戻り値:
 *   - `ok: true, invite_code_id: <uuid>`: クライアントはこの値を redeem API に渡す
 *   - `ok: false, error: '無効な招待コードです'`: それ以外すべて
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SERVICE_MODE } from '@/lib/config'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // 招待制 OFF なら検証スキップ
  if (!SERVICE_MODE.inviteOnly) return NextResponse.json({ ok: true, invite_code_id: null })

  // IP ベースのレート制限（未認証 API なので user ベースが使えない）
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const rl = await rateLimit({ key: `invite-verify:${ip}`, limit: 5, windowSec: 60 })
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'リクエストが多すぎます。しばらくしてから再試行してください' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const codeRaw: unknown = body.code
  if (typeof codeRaw !== 'string') {
    return NextResponse.json({ ok: false, error: '無効な招待コードです' })
  }
  const code = codeRaw.trim().toUpperCase()
  // 形式チェック。誤った形式は DB クエリ前に弾く。
  //   - MYF-XXXXXX: 管理画面の自動発行コード
  //   - 英数4〜16文字: キャンペーン用バニティコード（例: MYFOCUS）
  if (!/^MYF-[A-Z2-9]{6}$/.test(code) && !/^[A-Z0-9]{4,16}$/.test(code)) {
    return NextResponse.json({ ok: false, error: '無効な招待コードです' })
  }

  const supabase = await createClient()
  const { data: invite } = await supabase
    .from('invite_codes')
    .select('id, max_uses, used_count, expires_at, is_active')
    .eq('code', code)
    .maybeSingle()

  // 存在しない / 無効化 / 上限到達 / 期限切れ → すべて同じエラーメッセージで返す
  // （存在判定や状態の情報漏洩を防ぐ）
  const valid =
    !!invite
    && invite.is_active
    && invite.used_count < invite.max_uses
    && (!invite.expires_at || new Date(invite.expires_at) >= new Date())

  if (!valid) {
    return NextResponse.json({ ok: false, error: '無効な招待コードです' })
  }

  return NextResponse.json({ ok: true, invite_code_id: invite!.id })
}
