/**
 * `?next=` パラメータの安全化（オープンリダイレクト対策）。
 *
 * 以前は login/page.tsx・signup/page.tsx が `raw.startsWith('/') && !raw.startsWith('//')`
 * という簡易チェックだけを独自実装しており、app/auth/callback/route.ts の safeNext()
 * （scheme混入・CR/LF・バックスラッシュ始まり・長さ制限まで弾く堅牢な実装）と食い違っていた。
 * 例えば `?next=/\evil.com` は簡易チェックを通過するが、ブラウザのURL正規化で
 * `//evil.com`（プロトコル相対URL）として解釈され、外部ドメインへのオープンリダイレクトに
 * 使われ得る。3箇所すべてでこの一つの実装を使うことで、同じ穴が別ファイルで再発するのを防ぐ。
 *
 * 戻り値: 安全な内部パス、または無効な場合は null。
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  // / で始まらない / // 始まり(プロトコル相対) / \ 始まり(ブラウザ正規化でプロトコル相対になり得る) は弾く
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  // スキーム混入('http:', 'javascript:' 等) や CR/LF/タブを含むものは弾く
  if (/^[a-z][a-z0-9+\-.]*:/i.test(raw) || /[\r\n\t]/.test(raw)) return null
  // 長さ制限（DoS/誤入力対策）
  if (raw.length > 256) return null
  return raw
}
