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
      // 監査で発覚: 従来はサムネイルがあればサムネイルしか審査しておらず、実際に
      // 販売される本体ファイル(file_url)が一度も AI 審査を通らずに承認され得た
      // （サムネだけ無害にして本体に違反コンテンツを仕込む抜け道）。
      // 本体は必ず審査し、サムネイルがあれば併せて審査して、より厳しい判定を採用する。
      let fileUrlToCheck: string | undefined
      if (content.file_url) {
        const { data: signed } = await supabase.storage
          .from('contents')
          .createSignedUrl(content.file_url, 120)  // 2分有効
        fileUrlToCheck = signed?.signedUrl
      }
      if (!fileUrlToCheck) {
        return NextResponse.json({ error: 'No image URL to moderate' }, { status: 400 })
      }
      const fileResult = await moderateImage(fileUrlToCheck)

      if (content.thumbnail_url) {
        const thumbResult = await moderateImage(content.thumbnail_url)
        const severity: Record<string, number> = { rejected: 2, pending: 1, approved: 0, skip: 0 }
        result = severity[thumbResult.verdict] > severity[fileResult.verdict] ? thumbResult : fileResult
      } else {
        result = fileResult
      }
    }

    // 結果を DB に反映
    const newStatus = result.verdict === 'skip' ? 'pending' : result.verdict
    // v28: review_status/is_published はクリエイター本人の直接updateでは書き換えられない
    // よう BEFORE UPDATE トリガーで保護されている。正規の確定は submit_moderation_result()
    // 経由のみ（内部で auth.uid() による所有権 + review_status='pending' の楽観ロックを
    // 検証する。並列モデレーション(同一コンテンツへの同時リクエスト)で後勝ち上書きが
    // 起きるのを防ぐのも同じ仕組み）。
    const { data: updated, error: uErr } = await supabase.rpc('submit_moderation_result', {
      p_content_id: content_id,
      p_new_status: newStatus,
      p_rejection_reason: newStatus === 'rejected' ? (result.reason ?? 'AI審査により却下されました') : null,
    })
    if (uErr) {
      console.error('[moderate] rpc error:', uErr)
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
    }
    if (updated !== true) {
      // 並列リクエストが先に確定済み（既に pending ではない）
      return NextResponse.json({ error: 'Already moderated' }, { status: 409 })
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
