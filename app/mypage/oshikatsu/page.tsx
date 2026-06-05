import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, Heart, TrendingUp, Calendar, Award } from 'lucide-react'
import { userTotalSupport } from '@/lib/rankings'
import { getProgress } from '@/lib/tiers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '推し活記録' }
export const dynamic = 'force-dynamic'

interface PurchaseRow {
  id: string
  amount: number
  tip_amount: number | null
  created_at: string
  content: {
    id: string
    title: string
    thumbnail_url: string | null
    creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  } | null
}

interface FollowRow {
  created_at: string
  creator: { id: string; display_name: string; username: string; avatar_url: string | null; bio: string | null } | null
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [, m] = key.split('-')
  return `${parseInt(m, 10)}月`
}

export default async function OshikatsuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/oshikatsu')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()

  // 購入履歴
  const { data: purchasesData } = await supabase
    .from('purchases')
    .select('id, amount, tip_amount, created_at, content:contents(id, title, thumbnail_url, creator:profiles(id, display_name, username, avatar_url))')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const purchases = (purchasesData ?? []) as unknown as PurchaseRow[]

  // フォロー履歴
  const { data: followsData } = await supabase
    .from('follows')
    .select('created_at, creator:profiles!follows_creator_id_fkey(id, display_name, username, avatar_url, bio)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: true })

  const follows = (followsData ?? []) as unknown as FollowRow[]

  const support = await userTotalSupport(user.id)
  const tier = getProgress(support.total)

  // 月次支出 (直近12ヶ月)
  const now = new Date()
  const months: { key: string; label: string; amount: number; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: monthLabel(key), amount: 0, count: 0 })
  }
  for (const p of purchases) {
    const k = monthKey(p.created_at)
    const m = months.find(x => x.key === k)
    if (m) {
      m.amount += (p.amount ?? 0) + (p.tip_amount ?? 0)
      m.count += 1
    }
  }
  const maxMonthly = Math.max(1, ...months.map(m => m.amount))
  const monthlyAvg = Math.round(months.reduce((s, m) => s + m.amount, 0) / 12)

  // 推し別集計（フォロー + 購入）
  type OshiAgg = {
    creator: NonNullable<FollowRow['creator']>
    followedAt: string | null
    days: number
    spent: number
    items: number
  }
  const oshiMap = new Map<string, OshiAgg>()
  for (const f of follows) {
    if (!f.creator) continue
    oshiMap.set(f.creator.id, {
      creator: f.creator,
      followedAt: f.created_at,
      days: daysSince(f.created_at),
      spent: 0,
      items: 0,
    })
  }
  for (const p of purchases) {
    const c = p.content?.creator
    if (!c) continue
    const existing = oshiMap.get(c.id)
    if (existing) {
      existing.spent += (p.amount ?? 0) + (p.tip_amount ?? 0)
      existing.items += 1
    } else {
      oshiMap.set(c.id, {
        creator: c as NonNullable<FollowRow['creator']>,
        followedAt: null,
        days: 0,
        spent: (p.amount ?? 0) + (p.tip_amount ?? 0),
        items: 1,
      })
    }
  }
  const oshiList = Array.from(oshiMap.values())
  const oshiByDays = [...oshiList].filter(o => o.followedAt).sort((a, b) => b.days - a.days)
  const oshiBySpent = [...oshiList].sort((a, b) => b.spent - a.spent).filter(o => o.spent > 0)

  // 1番の推し
  const numberOneOshi = oshiBySpent[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 22 }}>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← マイページへ</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 }}>
            <Sparkles size={22} color="#ec4899" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>推し活記録</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>あなたの推しへの想いを可視化</p>
        </div>

        {/* サマリーカード */}
        <div className="mm-card" style={{ padding: '22px 24px', marginBottom: 24, background: `linear-gradient(135deg, ${tier.current.bg} 0%, white 70%)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>{tier.current.emoji}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: tier.current.color, letterSpacing: '0.08em' }}>YOUR TIER</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: tier.current.color, marginTop: 2 }}>{tier.current.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--mm-text)', marginTop: 6 }}>累計 ¥{support.total.toLocaleString()}</p>
            </div>
          </div>
          {tier.next && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${tier.percent}%`, background: tier.current.color, transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 6 }}>
                次のティア {tier.next.emoji} {tier.next.label} まで あと ¥{tier.remainYen.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* 統計バー */}
        <div className="mm-stats-grid" style={{ marginBottom: 28, gap: 0, border: '1px solid var(--mm-border)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
          <StatCell value={`${oshiList.length}`} label="推し人数" color="#ec4899" />
          <StatCell value={`${support.count}`} label="購入数" color="var(--mm-primary)" />
          <StatCell value={`¥${monthlyAvg.toLocaleString()}`} label="月平均支出" color="#a855f7" />
          <StatCell value={`${oshiByDays[0]?.days ?? 0}日`} label="最長推し期間" color="#f59e0b" />
        </div>

        {/* 1番の推し */}
        {numberOneOshi && (
          <div className="mm-card" style={{ padding: '20px 22px', marginBottom: 28, background: 'linear-gradient(135deg, #fdf2f8 0%, white 70%)', border: '2px solid #fbcfe8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Award size={18} color="#ec4899" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', letterSpacing: '0.05em' }}>NUMBER ONE 推し</p>
            </div>
            <Link href={`/creator/${numberOneOshi.creator.username}`} style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', flexWrap: 'wrap' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'white', overflow: 'hidden', border: '3px solid #fbcfe8', flexShrink: 0 }}>
                {numberOneOshi.creator.avatar_url
                  ? <img src={numberOneOshi.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28 }}>👤</div>}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--mm-text)' }}>{numberOneOshi.creator.display_name}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>@{numberOneOshi.creator.username}</p>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ec4899' }}>¥{numberOneOshi.spent.toLocaleString()}</span>
                  <span style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>{numberOneOshi.items}件購入</span>
                  {numberOneOshi.followedAt && (
                    <span style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>推し歴 {numberOneOshi.days}日</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* 月次支出グラフ */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={18} color="var(--mm-primary)" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>月次支出 (直近12ヶ月)</h2>
          </div>
          <div className="mm-card" style={{ padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, paddingBottom: 24, borderBottom: '1px solid var(--mm-border)' }}>
              {months.map(m => {
                const heightPct = (m.amount / maxMonthly) * 100
                return (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }} title={`${m.label}: ¥${m.amount.toLocaleString()}`}>
                    {m.amount > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--mm-text-sub)', whiteSpace: 'nowrap' }}>
                        ¥{(m.amount / 1000).toFixed(m.amount >= 10000 ? 0 : 1)}k
                      </span>
                    )}
                    <div style={{
                      width: '100%',
                      height: `${Math.max(heightPct, m.amount > 0 ? 4 : 0)}%`,
                      minHeight: m.amount > 0 ? 6 : 0,
                      background: m.amount > 0
                        ? 'linear-gradient(180deg, #ec4899 0%, #a855f7 100%)'
                        : 'transparent',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.4s',
                    }} />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {months.map(m => (
                <div key={m.key} style={{ flex: 1, fontSize: 10, color: 'var(--mm-text-muted)', textAlign: 'center' }}>{m.label}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 推し期間ランキング */}
        {oshiByDays.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Calendar size={18} color="#f59e0b" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>推し期間ランキング</h2>
            </div>
            <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
              {oshiByDays.slice(0, 10).map((o, i) => (
                <Link key={o.creator.id} href={`/creator/${o.creator.username}`} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderBottom: i < Math.min(9, oshiByDays.length - 1) ? '1px solid var(--mm-border)' : 'none',
                  textDecoration: 'none',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--mm-text-muted)', width: 28, textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                    {o.creator.avatar_url
                      ? <img src={o.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 18 }}>👤</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.creator.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                      推し歴 <strong style={{ color: '#f59e0b' }}>{o.days}日</strong>
                      {o.spent > 0 && <> · 累計 ¥{o.spent.toLocaleString()}</>}
                    </p>
                  </div>
                  <Heart size={14} color="#ec4899" fill="#ec4899" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 支出ランキング */}
        {oshiBySpent.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={18} color="#ec4899" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>支援額ランキング</h2>
            </div>
            <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
              {oshiBySpent.slice(0, 10).map((o, i) => {
                const pct = (o.spent / oshiBySpent[0].spent) * 100
                return (
                  <Link key={o.creator.id} href={`/creator/${o.creator.username}`} style={{
                    display: 'block', padding: '14px 18px',
                    borderBottom: i < Math.min(9, oshiBySpent.length - 1) ? '1px solid var(--mm-border)' : 'none',
                    textDecoration: 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? '#ec4899' : 'var(--mm-text-muted)', width: 28, textAlign: 'center' }}>
                        {i + 1}
                      </span>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                        {o.creator.avatar_url
                          ? <img src={o.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 16 }}>👤</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.creator.display_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{o.items}件購入</p>
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#ec4899', flexShrink: 0 }}>¥{o.spent.toLocaleString()}</p>
                    </div>
                    <div style={{ height: 4, background: 'rgba(236,72,153,0.12)', borderRadius: 2, overflow: 'hidden', marginLeft: 42 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 100%)' }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {oshiList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>💗</p>
            <p style={{ fontSize: 15, marginBottom: 8 }}>まだ推しがいません</p>
            <Link href="/creators" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>クリエイターを探す →</Link>
          </div>
        )}

      </div>
    </div>
  )
}

function StatCell({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid var(--mm-border)' }}>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>{label}</p>
    </div>
  )
}
