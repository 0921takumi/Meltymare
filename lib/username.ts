import { randomBytes } from 'node:crypto'

/**
 * ID(username)関連の共通ルール。
 *
 * 背景: 従来 signup 時の username は email のローカル部（@より前）をそのまま
 * 使っており、/creator/[username] 等で誰でも見られる公開URLに個人情報（メール
 * アドレスの一部）が丸見えになっていた。ここでは「emailと一切紐付かないランダムな
 * 初期ID」と「本人が変更する際のフォーマット検証」を一箇所にまとめる。
 */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

// 混同・なりすまし・URL衝突を招きやすい予約語（大文字小文字は問わずブロック）。
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'staff', 'official',
  'myfocus', 'my-focus', 'system', 'null', 'undefined', 'api',
  'creator', 'creators', 'user', 'users', 'me', 'you',
])

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}

export function usernameFormatError(raw: string): string | null {
  const username = raw.trim().toLowerCase()
  if (!USERNAME_RE.test(username)) {
    return 'IDは半角英数字と_(アンダースコア)のみ、3〜20文字で入力してください。'
  }
  if (isReservedUsername(username)) {
    return 'このIDは予約語のため使用できません。'
  }
  return null
}

/** email等の個人情報と一切紐付かない、ランダムな初期ID（signup直後の仮ID）を生成する。 */
export function randomUsername(): string {
  return `u${randomBytes(6).toString('hex')}` // 例: u3f9a2b1c8d4e （13文字、英数字のみ）
}
