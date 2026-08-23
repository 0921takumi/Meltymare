import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Upstash が「設定済みだが呼ぶと必ず失敗する」状態を再現する。
// 2026-08 の事故（Upstash 障害で /api/purchase が全件429になり売上が止まった）の再発防止。
const incr = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    incr = incr
    expire = vi.fn()
    pttl = vi.fn()
  },
}))

describe('rateLimit: Upstash 障害時', () => {
  beforeEach(() => {
    vi.resetModules()
    incr.mockReset()
    incr.mockRejectedValue(new Error('upstash down'))
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.invalid'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'dummy'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.restoreAllMocks()
  })

  it('決済導線を429で全ブロックせず、インメモリ制限に退避して通す', async () => {
    const { rateLimit } = await import('./rate-limit')
    const r = await rateLimit({ key: `purchase:${Math.random()}`, limit: 30, windowSec: 60 })
    expect(r.ok).toBe(true)
  })

  it('退避先でも上限を超えれば従来どおり拒否する（無制限素通しではない）', async () => {
    const { rateLimit } = await import('./rate-limit')
    const key = `purchase:${Math.random()}`
    const opts = { key, limit: 3, windowSec: 60 }
    expect((await rateLimit(opts)).ok).toBe(true)
    expect((await rateLimit(opts)).ok).toBe(true)
    expect((await rateLimit(opts)).ok).toBe(true)
    expect((await rateLimit(opts)).ok).toBe(false)
  })

  it('旧 failClosed 指定が残っていても購入を止めない', async () => {
    const { rateLimit } = await import('./rate-limit')
    const r = await rateLimit({ key: `tip:${Math.random()}`, limit: 20, windowSec: 60, failClosed: true })
    expect(r.ok).toBe(true)
  })
})
