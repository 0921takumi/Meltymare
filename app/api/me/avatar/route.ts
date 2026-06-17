/**
 * アバター画像アップロード API（本人のみ）
 *
 * 背景 / 修正理由:
 *   プロフィール編集の旧実装はブラウザの匿名/認証クライアントから直接
 *   storage('thumbnails') に upload していたが、本番のストレージ RLS が
 *   その経路を許可しておらず（new row violates row-level security policy）、
 *   しかも upload の error を一切チェックせず getPublicUrl で「実在しない
 *   ファイルを指す壊れた URL」を profiles.avatar_url に保存していた。
 *   結果、写真を設定しても表示が壊れる（404）。
 *
 *   本 API は service_role でアップロードして RLS 依存を排除し、失敗時は
 *   明示的にエラーを返す。EXIF 除去はクライアント側で実施済みの blob を受け取る。
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })

  const rl = await rateLimit({ key: `avatar:${user.id}`, limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください' }, { status: 429 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '画像ファイルがありません' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '画像は5MB以下にしてください' }, { status: 400 })
  const ext = ALLOWED[file.type]
  if (!ext) return NextResponse.json({ error: 'JPEG / PNG / WebP 形式のみ対応しています' }, { status: 400 })

  const admin = createAdminClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  // 公開バケット 'avatars'（v24 で public 化）に本人 id 名で保存。
  const path = `${user.id}.${ext}`

  const { error: upErr } = await admin.storage.from('avatars').upload(path, bytes, {
    upsert: true,
    contentType: file.type,
  })
  if (upErr) {
    console.error('[api/me/avatar] upload failed:', upErr.message, 'user:', user.id)
    return NextResponse.json({ error: '画像のアップロードに失敗しました。時間をおいて再度お試しください' }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
  // キャッシュ破棄のため毎回クエリを付与（同一パスを upsert するため）
  return NextResponse.json({ ok: true, url: `${pub.publicUrl}?t=${Date.now()}` })
}
