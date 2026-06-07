/**
 * POST /api/moderate
 *
 * 投稿コンテンツの AI モデレーションを実行し、結果に応じて `contents.review_status` を更新する。
 *
 * 呼び出し元: クリエイターのアップロード成功直後（クライアント側）。
 * 非同期処理として割り切り、結果が返るまでクライアントは「審査中」表示。
 *
 * 認可:
 *   - 自分のコンテンツの初回モデレーションのみ実行可（content.creator_id === user.id）
 *   - 既に approved/rejected のものは再実行不可（=管理者の手動上書きを上書きしない）
 *
 * 副作用:
 *   - `review_status`: pending/approved/rejected を書き込む
 *   - `is_published`: rejected の場合は強制 false に
 *   - `audit_logs`: 結果を記録（admin/creator 両方が確認できる）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { moderateImage, moderateVideo } from '@/lib/moderation'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await rateLimit({ key: `moderate:${user.id}`, limit: 30, windowSec: 60 })
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { content_id } = await req.json()
    if (!content_id || !UUID_RE.test(content_id)) {
      return NextResponse.json({ error: 'Invalid content_id' }, { status: 400 })
    }

    // 自分のコンテンツであり、未審査である必要あり
    const { data: content, error: cErr } = await supabase
      .from('contents')
      .select('id, creator_id, content_type, thumbnail_url, file_url, review_status, is_published')
      .eq('id', content_id)
      .maybeSingle()
    if (cErr || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    if (content.creator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (content.review_status !== 'pending') {
      return NextResponse.json({
        error: 'Already moderated',
        status: content.review_status,
      }, { status: 409 })
    }

    // モデレーション実行
    let result
    if (content.content_type === 'video') {
      // 動画は当面、人力レビュー必須
      result = await moderateVideo()
    } else {
      // 画像系: サムネイル URL を判定対象に
      // file_url は Supabase Storage の path（private bucket）なので、署名URLを発行
      let urlToCheck = content.thumbnail_url
      if (!urlToCheck && content.file_url) {
        const { data: signed } = await supabase.storage
          .from('contents')
          .createSignedUrl(content.file_url, 120)  // 2分有効
        urlToCheck = signed?.signedUrl
      }
      if (!urlToCheck) {
        return NextResponse.json({ error: 'No image URL to moderate' }, { status: 400 })
      }
      result = await moderateImage(urlToCheck)
    }

    // 結果を DB に反映
    const newStatus = result.verdict === 'skip' ? 'pending' : result.verdict
    const updatePayload: { review_status: string; is_published?: boolean } = {
      review_status: newStatus,
    }
    if (newStatus === 'rejected') {
      updatePayload.is_published = false
    }
    const { error: uErr } = await supabase
      .from('contents')
      .update(updatePayload)
      .eq('id', content_id)
    if (uErr) {
      console.error('[moderate] update error:', uErr)
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
    }

    // 監査ログ
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'content.moderate',
      target_type: 'content',
      target_id: content_id,
      metadata: {
        verdict: result.verdict,
        reason: result.reason ?? null,
        labels: result.labels.slice(0, 10),  // 上位10件のみ保存
      },
    })

    return NextResponse.json({
      verdict: result.verdict,
      reason: result.reason ?? null,
    })
  } catch (e: unknown) {
    console.error('[moderate] error:', e)
    return NextResponse.json({ error: 'Moderation failed' }, { status: 500 })
  }
}
