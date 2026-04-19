// 簡易レートリミッタ（インメモリ）
// 本番でマルチインスタンスになる場合は Upstash Redis 等に差し替え。
// Vercel Serverless では同一インスタンスに同じキーが来る保証はないので、
// 「最後の防波堤」としてのベストエフォート制限。厳密な制御は Supabase 側の RLS/制約で担保する。

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// 定期的に古いバケットを掃除
let lastCleanup = Date.now()
function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  /** 識別子（ユーザーID優先、無ければIP） */
  key: string
  /** 最大リクエスト数 */
  limit: number
  /** ウィンドウ秒数 */
  windowSec: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit({ key, limit, windowSec }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  cleanup(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowSec * 1000
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt }
  }
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
