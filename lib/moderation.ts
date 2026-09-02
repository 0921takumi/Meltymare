/**
 * AI コンテンツモデレーション（AWS Rekognition）
 *
 * 設計:
 *   - AWS Rekognition `DetectModerationLabels` で投稿画像を判定。
 *   - 信頼度（Confidence）が閾値（既定 80）以上のラベルを「違反」とみなす。
 *   - 環境変数（`AWS_*`）未設定なら、`{ ok: 'skip' }` を返し、運用側で人力審査に回す前提。
 *
 * 制限事項:
 *   - 動画はこの関数では扱わない。動画は `StartContentModeration` で非同期処理が必要なため、
 *     別途ジョブ管理を実装する（Phase 2）。当面は **動画はクリエイター審査済みのみ受付け** とし、
 *     管理画面で目視確認 → is_published を切り替える運用にする。
 *   - Free tier: 月5,000枚まで無料、超過分は $0.001/枚。
 *
 * 環境変数（本番に必須）:
 *   - AWS_REGION                  ap-northeast-1 推奨
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - AWS_REKOGNITION_THRESHOLD   デフォルト 80
 */

import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition'

const REGION = process.env.AWS_REGION
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY
const THRESHOLD = Number(process.env.AWS_REKOGNITION_THRESHOLD ?? 80)

// AWS 認証情報未設定なら客先運用を強制（明示的に skip 返す）
const isConfigured = !!(REGION && ACCESS_KEY && SECRET_KEY)

const client = isConfigured
  ? new RekognitionClient({
      region: REGION!,
      credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
    })
  : null

if (!isConfigured && process.env.NODE_ENV === 'production') {
  console.warn('[moderation] AWS Rekognition 未設定。本番では AWS_* 環境変数を設定してください。')
}

// ─── 違反系のカテゴリ ─────────────────────────────
// Rekognition が返す上位カテゴリのうち、自動却下対象に含めるラベル。
// 詳細: https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html
const HARD_REJECT_LABELS = [
  'Explicit Nudity',          // 性的明示
  'Explicit Sexual Activity', // 性行為
  'Sex Toys',
  'Adult Toys',
  'Violence',                 // 暴力
  'Visually Disturbing',      // 視覚的不快コンテンツ
  'Self-Injury',              // 自傷
  'Hate Symbols',             // ヘイトシンボル
  'Drugs',
  'Drug Use',
  'Drug Products',
  'Drug Paraphernalia',
]

// 警告だけ出して人力レビューに回すラベル（自動承認しない）
const SOFT_FLAG_LABELS = [
  'Non-Explicit Nudity of Intimate parts and Kissing',
  'Female Swimwear or Underwear',
  'Male Swimwear or Underwear',
  'Revealing Clothes',
  'Alcohol',
  'Smoking',
  'Tobacco',
  'Gambling',
]

export type ModerationVerdict = 'approved' | 'rejected' | 'pending' | 'skip'

export interface ModerationResult {
  verdict: ModerationVerdict
  /** 検出されたラベル一覧（debug 用） */
  labels: Array<{ name: string; confidence: number; parent?: string }>
  /** 却下/保留の理由 */
  reason?: string
  /** スキップ理由（AI 未設定等） */
  note?: string
}

/**
 * 画像 URL or バイト列をモデレーション。
 *
 * @param input  - HTTPS 公開URL or Uint8Array バイト列。
 *                 Supabase Storage の private bucket の場合は事前に署名URLを発行して渡すこと。
 */
/**
 * Rekognition の 5MB 上限に収まるように画像を縮小する。
 * Node ランタイム上で追加依存なしに扱うため、外部変換サービスは使わず
 * `@napi-rs/canvas` 等が無い環境でも動くよう、失敗したら null を返して呼び出し側で保留にする。
 */
async function shrinkForModeration(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    // sharp があれば使う（Vercel の Node ランタイムには next/image 経由で同梱されることが多い）
    const mod: any = await import('sharp').catch(() => null)
    if (!mod) return null
    const sharp = mod.default ?? mod
    let quality = 80
    let width = 2000
    for (let i = 0; i < 4; i++) {
      const out: Buffer = await sharp(Buffer.from(bytes))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer()
      if (out.length <= 5 * 1024 * 1024) return new Uint8Array(out)
      width = Math.round(width * 0.7)
      quality -= 10
    }
    return null
  } catch (err) {
    console.error('[moderation] shrink failed:', err)
    return null
  }
}

export async function moderateImage(input: string | Uint8Array): Promise<ModerationResult> {
  if (!client) {
    return { verdict: 'skip', labels: [], note: 'AI moderation not configured' }
  }

  try {
    let bytes: Uint8Array
    if (typeof input === 'string') {
      const res = await fetch(input)
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
      bytes = new Uint8Array(await res.arrayBuffer())
    } else {
      bytes = input
    }

    // Rekognition はバイト列指定時 5MB まで。スマホ写真は普通に超えるため、
    // 以前はここで素通り(pending=販売中)になっており、実質ほとんどの写真が無審査だった。
    // さらに「違反画像を5MB超に膨らませれば検査を回避できる」状態でもあった。
    // 縮小して検査する（判定に必要な解像度は十分に残る）。
    if (bytes.length > 5 * 1024 * 1024) {
      const shrunk = await shrinkForModeration(bytes)
      if (!shrunk) {
        return {
          verdict: 'pending',
          labels: [],
          reason: 'File >5MB and could not be resized for scanning',
        }
      }
      bytes = shrunk
    }

    const cmd = new DetectModerationLabelsCommand({
      Image: { Bytes: bytes },
      MinConfidence: 50,  // 50% 以上のものは全て返してもらい、こちら側で振り分け
    })
    const out = await client.send(cmd)

    const labels = (out.ModerationLabels ?? []).map(l => ({
      name: l.Name ?? '',
      confidence: l.Confidence ?? 0,
      parent: l.ParentName ?? undefined,
    }))

    // Hard reject 判定
    const rejectHit = labels.find(l =>
      HARD_REJECT_LABELS.includes(l.name) && l.confidence >= THRESHOLD,
    )
    if (rejectHit) {
      return {
        verdict: 'rejected',
        labels,
        reason: `${rejectHit.name} (${rejectHit.confidence.toFixed(1)}%)`,
      }
    }

    // Soft flag 判定 → 人力レビュー
    const softHit = labels.find(l =>
      SOFT_FLAG_LABELS.includes(l.name) && l.confidence >= THRESHOLD,
    )
    if (softHit) {
      return {
        verdict: 'pending',
        labels,
        reason: `Flagged for manual review: ${softHit.name} (${softHit.confidence.toFixed(1)}%)`,
      }
    }

    // 何も引っ掛からなければ承認
    return { verdict: 'approved', labels }
  } catch (err) {
    console.error('[moderation] error:', err)
    // 失敗時はフェイルクローズ（保留扱いで人力に回す）
    return {
      verdict: 'pending',
      labels: [],
      reason: `Moderation error: ${(err as Error).message}`,
    }
  }
}

/**
 * 動画モデレーション（プレースホルダ）。
 * Phase 2 で `StartContentModeration` + SNS/SQS 通知の非同期ジョブを実装予定。
 * それまでは常に `pending` を返し、人力レビュー必須。
 */
export async function moderateVideo(): Promise<ModerationResult> {
  return {
    verdict: 'pending',
    labels: [],
    reason: 'Video moderation requires manual review (async implementation pending)',
  }
}
