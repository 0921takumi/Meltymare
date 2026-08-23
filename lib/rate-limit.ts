/**
 * レートリミッタ — Upstash Redis 優先、未設定時は in-memory フォールバック。
 *
 * 設計:
 *   - 本番（Vercel等）でマルチインスタンスになるため、グローバルに集計できる Upstash を最優先。
 *   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` が未設定でも開発環境では動くよう
 *     インメモリにフォールバック（dev/test 用のみ。本番では必ず Upstash 設定すること）。
 *   - API 経由でしか触らない（Edge runtime でも動く）ので REST 版を使用。
 *
 * 使い方:
 *   const rl = await rateLimit({ key: `purchase:${userId}`, limit: 10, windowSec: 60 })
 *   if (!rl.ok) return NextResponse.json({ error: '...' }, { status: 429 })
 */

import { Redis } from '@upstash/redis'

// ─── Upstash クライアント（環境変数あれば初期化） ──────────────────
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const redis: Redis | null = (REDIS_URL && REDIS_TOKEN)
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null

if (!redis && process.env.NODE_ENV === 'production') {
  // 本番で Upstash 未設定は危険なので明示的に警告。
  // throw にすると起動失敗するので console.warn にとどめる（運用ミス検知用）。
  console.warn('[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN 未設定。本番では必ず設定してください。')
}

// ─── インメモリフォールバック（dev/test 用） ─────────────────────
type Bucket = { count: number; resetAt: number }
const memBuckets = new Map<string, Bucket>()
let lastCleanup = Date.now()
function memCleanup(now: number) {
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, b] of memBuckets) {
    if (b.resetAt < now) memBuckets.delete(key)
  }
}

// ─── パブリック API ──────────────────────────────────────────────
export interface RateLimitOptions {
  /** 識別子（ユーザーID優先、無ければIP） */
  key: string
  /** 最大リクエスト数 */
  limit: number
  /** ウィンドウ秒数 */
  windowSec: number
  /**
   * 【非推奨・後方互換のみ】以前は Redis 障害時に 429 で拒否する指定だったが、
   * Upstash 障害で全購入が止まる事故（2026-08）を受けて廃止した。
   * 現在は障害時、この値に関わらずインメモリ制限へ退避する。
   */
  failClosed?: boolean
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

/**
 * レート制限チェック。**非同期**になった点に注意（Upstash REST 呼び出しのため）。
 *
 * 既存呼び出し側（同期で `rateLimit({...})` していたコード）は `await` を追加すること。
 */
// インメモリ判定本体。Upstash 未設定時のフォールバックに加え、Upstash 障害時の
// 退避先としても使う（下の catch 参照）。
function memoryLimit(fullKey: string, limit: number, windowSec: number, now: number): RateLimitResult {
  memCleanup(now)
  const bucket = memBuckets.get(fullKey)
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowSec * 1000
    memBuckets.set(fullKey, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt }
  }
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

export async function rateLimit({ key, limit, windowSec, failClosed = false }: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now()
  const fullKey = `rl:${key}`

  // ─── Upstash 版（本番想定） ─────────────────────
  if (redis) {
    try {
      // INCR でカウントし、初回（count===1）のみ EXPIRE で TTL を張る。
      // EXPIRE の 'NX' オプションは Upstash のプラン/REST 実装によって弾かれ、
      // pipeline 全体が失敗→fail-open に落ちることがあるため使わない。
      // count===1 判定で「初回だけ TTL を設定」= NX 相当を互換性高く実現する。
      const count = await redis.incr(fullKey)
      if (count === 1) {
        await redis.expire(fullKey, windowSec)
      }
      const pttl = await redis.pttl(fullKey)

      const resetAt = pttl > 0 ? now + pttl : now + windowSec * 1000
      if (count > limit) {
        return { ok: false, remaining: 0, resetAt }
      }
      return { ok: true, remaining: limit - count, resetAt }
    } catch (err) {
      // Redis 障害時の挙動は用途で分岐する。
      //   failClosed=true（決済系・金銭直撃）→ fail-closed(429)。スパムを通すリスクの方が
      //                                        一時的な決済不可より深刻なため拒否する。
      //   failClosed=false（閲覧・通知系）  → fail-open。Redis 障害でのサービス全停止を避ける。
      // 2026-08 障害: ここが failClosed=true で「Upstash が死んだ瞬間に全ての購入が429」
      // になり、売上が丸ごと止まる事故が起きた。決済導線を止める損失は、スパムを一時的に
      // 通す損失より遥かに大きい（/api/purchase は Stripe Checkout セッションを作るだけで
      // 課金は発生せず、二重購入は purchases の unique 制約が別途防ぐ）。
      // 「拒否」でも「素通し」でもなく、インメモリ制限に退避して守りを残したまま継続する。
      console.error(`[rate-limit] Upstash error → in-memory へ退避 (key=${key}):`, err)
      return memoryLimit(fullKey, limit, windowSec, now)
    }
  }

  // ─── インメモリ版（Upstash 未設定時のフォールバック） ──────────
  return memoryLimit(fullKey, limit, windowSec, now)
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
