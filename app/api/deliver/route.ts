import { NextResponse } from 'next/server'
import { requireCreator } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

/**
 * 納品確定エンドポイント
 *
 * 背景: purchases には UPDATE の RLS ポリシーが無く、クライアントから直接
 *   delivery_status を更新しようとすると 0 行更新でサイレント失敗していた
 *   （「納品したのに購入者に届かない」事故）。書き込みは service_role(admin) に集約し、
 *   サーバー側で所有権・パストラバーサルを検証してから確定する。
 *
 * セキュリティ:
 *   - 認証必須 / creator|admin のみ
 *   - purchase の content.creator が本人であること（所有権）
 *   - file_path が `${user.id}/` 配下であること（他人のフォルダ指定を防ぐ）
 *   - rate limit
 */

const UUID_RE = /^[0-9a-f-]{36}$/i

const admin = createAdminClient()

export async function POST(req: Request) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { user, role } = ctx

  const rl = await rateLimit({ key: `deliver:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const purchaseId = body?.purchase_id
  const filePath = body?.file_path

  if (typeof purchaseId !== 'string' || !UUID_RE.test(purchaseId)) {
    return NextResponse.json({ error: 'invalid_purchase' }, { status: 400 })
  }
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > 512) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }
  // パストラバーサル防止: 自分のフォルダ配下のみ許可
  if (!filePath.startsWith(`${user.id}/`) || filePath.includes('..')) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }

  // 所有権確認: この purchase のコンテンツのクリエイターが本人か
  const { data: purchase } = await admin
    .from('purchases')
    .select('id, status, content:contents(creator_id)')
    .eq('id', purchaseId)
    .maybeSingle()
  if (!purchase) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const content = purchase.content as { creator_id?: string } | null
  if (content?.creator_id !== user.id && role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  // 完了済みの購入のみ納品可（pending/failed には納品しない）
  if (purchase.status !== 'completed') {
    return NextResponse.json({ error: 'purchase_not_completed' }, { status: 400 })
  }

  const { error } = await admin
    .from('purchases')
    .update({
      delivery_status: 'delivered',
      delivered_file_url: filePath,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', purchaseId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
