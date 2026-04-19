// UGC（ユーザー生成コンテンツ）のサニタイズと制限
// React は {text} 埋め込み時に自動エスケープするので XSS の一次防御はフレームワーク側。
// ただし DB に入れる前に以下を行う:
//  - 制御文字除去
//  - 長さ制限（DoS/コスト対策）
//  - 前後の空白除去

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export interface SanitizeOptions {
  maxLength?: number
  allowNewlines?: boolean
}

export function sanitizeText(input: unknown, opts: SanitizeOptions = {}): string {
  if (typeof input !== 'string') return ''
  const { maxLength = 2000, allowNewlines = true } = opts
  let s = input.replace(CONTROL_CHARS, '')
  if (!allowNewlines) s = s.replace(/[\r\n]+/g, ' ')
  s = s.trim()
  if (s.length > maxLength) s = s.slice(0, maxLength)
  return s
}

export function sanitizeOptional(input: unknown, opts?: SanitizeOptions): string | null {
  const s = sanitizeText(input, opts)
  return s.length > 0 ? s : null
}

// 極めて緩い URL バリデータ。スキーム制限でスクリプト URI などを弾く。
const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.trim()
  if (!s) return null
  try {
    const url = new URL(s)
    if (!ALLOWED_SCHEMES.has(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

// 画像/動画アップロードの許可 MIME とサイズ上限（10MB 画像, 200MB 動画）
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024

export function validateUpload(
  file: { type: string; size: number },
  kind: 'image' | 'video'
): { ok: true } | { ok: false; error: string } {
  const allowed = kind === 'image' ? ALLOWED_IMAGE_MIME : ALLOWED_VIDEO_MIME
  const maxSize = kind === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (!(allowed as readonly string[]).includes(file.type)) {
    return { ok: false, error: `許可されていないファイル形式です（${file.type}）` }
  }
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024)
    return { ok: false, error: `ファイルサイズが上限を超えています（最大${mb}MB）` }
  }
  if (file.size === 0) {
    return { ok: false, error: 'ファイルが空です' }
  }
  return { ok: true }
}
