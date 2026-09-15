/**
 * 画面から叩いた API が失敗したときに、利用者に見せる日本語メッセージを作る。
 *
 * 背景(2026-09): 管理コンソールの「クリエイターに昇格」が「押しても反応しない」と報告された。
 * 実際は API が「本人確認が未承認」で拒否していたのに、画面側が `if (res.ok)` だけで
 * 失敗時に何もしておらず、利用者には何が起きたか一切伝わっていなかった。
 * 同じ書き方が管理画面・クリエイター画面に複数あったため、表示の作り方をここに一本化する。
 */

/** API が返すエラーコード → 利用者向けの説明 */
const MESSAGES: Record<string, string> = {
  // 管理: ユーザー操作
  identity_not_approved: '本人確認が承認されていないため、クリエイターにできません。本人が本人確認を提出し、「本人確認」ページで承認すると自動でクリエイターになります。',
  cannot_change_own_role: '自分自身のロールは変更できません。',
  cannot_demote_admin: '管理者のロールは管理画面から変更できません。',
  role_change_blocked: '管理者権限の付与・解除は管理画面からはできません。',
  no_changes: '変更する内容がありません。',
  // 共通
  Unauthorized: 'ログインが切れています。再度ログインしてください。',
  unauthorized: 'ログインが切れています。再度ログインしてください。',
  forbidden: 'この操作を行う権限がありません。',
  rate_limited: '操作が続いたため一時的に制限されています。少し待ってからお試しください。',
  account_suspended: 'このアカウントは現在ご利用いただけません。',
  invalid: '入力内容が正しくありません。画面を再読み込みしてからお試しください。',
  // コメント通報
  report_not_found: '対象の通報が見つかりません（すでに処理済みの可能性があります）。画面を再読み込みしてください。',
  comment_not_found: '対象のコメントが見つかりません（すでに削除済みの可能性があります）。',
  // その他
  creator_not_found: '対象のクリエイターが見つかりません。',
}

/**
 * 失敗したレスポンスから表示用メッセージを作る。
 * 優先順: 既知のコード → API が返した日本語の detail/message → 汎用文言＋ステータス
 */
export async function apiErrorMessage(res: Response, fallback = '処理に失敗しました'): Promise<string> {
  let body: { error?: unknown; detail?: unknown; message?: unknown } = {}
  try { body = await res.clone().json() } catch { /* 本文が JSON でない */ }
  const code = typeof body.error === 'string' ? body.error : ''
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (typeof body.detail === 'string' && body.detail) return body.detail
  if (typeof body.message === 'string' && body.message) return body.message
  if (res.status === 401) return MESSAGES.Unauthorized
  if (res.status === 403) return MESSAGES.forbidden
  if (res.status === 429) return MESSAGES.rate_limited
  return `${fallback}（エラー ${res.status}${code ? `: ${code}` : ''}）`
}

/** 通信そのものが失敗したとき（オフライン・タイムアウト等）の文言 */
export const NETWORK_ERROR_MESSAGE = '通信に失敗しました。電波の良い場所で、もう一度お試しください。'
