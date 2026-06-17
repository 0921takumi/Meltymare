/**
 * 署名付きアップロードURL発行 API（本人のみ / contents・thumbnails）
 *
 * 背景 / 設計理由:
 *   本番では storage RLS が「認証ユーザーの本人フォルダへの upload」を許可しておらず、
 *   かつ Supabase の新仕様で SQL Editor から storage.objects のポリシーを作成できない
 *   ため、クライアント直 upload は失敗していた（new row violates RLS）。
 *
 *   そこで service_role で署名付きアップロードURLを発行し、クライアントはそのURLへ
 *   直接アップロードする方式に変更。これにより:
 *     - storage RLS に一切依存しない（ポリシー整備不要）
 *     - 大容量（動画）でもアプリのサーバーを経由しない直アップロードで安全
 *     - パスは常にサーバが「本人フォルダ」で生成するため、他人領域には書けない
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const BUCKETS = new Set(['contents', 'thumbnails'])
const EXT_RE = /^[a-z0-9]{1,5}$/

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })

  const rl = await rateLimit({ key: `upload-url:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const bucket = String(body.bucket ?? '')
  const ext = String(body.ext ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!BUCKETS.has(bucket)) return NextResponse.json({ error: 'invalid bucket' }, { status: 400 })
  if (!EXT_RE.test(ext)) return NextResponse.json({ error: 'invalid ext' }, { status: 400 })

  // パスは必ずサーバ側で「本人フォルダ」に生成（クライアントはフォルダを指定できない）
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `${user.id}/${Date.now()}_${rand}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[api/me/upload-url] createSignedUploadUrl failed:', error?.message, 'user:', user.id, 'bucket:', bucket)
    return NextResponse.json({ error: 'アップロードURLの発行に失敗しました' }, { status: 500 })
  }

  const out: { path: string; token: string; publicUrl?: string } = { path: data.path, token: data.token }
  // thumbnails は公開バケットなので表示用URLも返す
  if (bucket === 'thumbnails') {
    const { data: pub } = admin.storage.from('thumbnails').getPublicUrl(path)
    out.publicUrl = pub.publicUrl
  }
  return NextResponse.json(out)
}
