/**
 * 公開バケット `thumbnails` の公開URLから、「削除してよい」オブジェクトキーを取り出す。
 *
 * 納品前レビューで発覚: contents.thumbnail_url はクリエイターが直接書ける列なので、
 * 他人のサムネイル（あるいはバケット内の任意キー）を指しておくと、運営が配信停止した
 * ときに service_role の remove() で他人のオブジェクトが消せてしまう。
 * 正規のキーは必ず `<creator_id>/<file>`（app/api/me/upload-url）なので、
 *   - 自プロジェクトの Supabase ホストであること
 *   - キーが `<ownerId>/` で始まること
 *   - '..' や空セグメントを含まないこと
 * を満たすときだけキーを返し、それ以外は null（削除しない）。
 */
export function ownedThumbnailPath(
  url: string | null | undefined,
  ownerId: string | null | undefined,
  supabaseUrl: string | null | undefined,
): string | null {
  if (!url || !ownerId) return null
  let target: URL
  let origin: string
  try {
    target = new URL(url)
    origin = new URL(supabaseUrl ?? '').origin
  } catch {
    return null
  }
  if (!origin || target.origin !== origin) return null

  const m = target.pathname.match(/^\/storage\/v1\/object\/public\/thumbnails\/(.+)$/)
  if (!m) return null

  let path: string
  try {
    path = decodeURIComponent(m[1])
  } catch {
    return null
  }
  if (!path.startsWith(`${ownerId}/`)) return null
  const segments = path.split('/')
  if (segments.length < 2 || segments.some(s => s === '' || s === '.' || s === '..')) return null
  return path
}
