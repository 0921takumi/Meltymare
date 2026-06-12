import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'
import { TrendingUp, Users, ShoppingBag, Flame } from 'lucide-react'
import { topCreators, trendingCreators, type Period, type CreatorRankRow } from '@/lib/rankings'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ランキング' }
export const dynamic = 'force-dynamic'

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309']
const METRIC_LABELS: Record<Metric, string> = { sales: '売上', purchases: '購入数', followers: 'フォロワー増' }

type Metric = 'sales' | 'purchases' | 'followers'

interface SearchParams {
  period?: string
  metric?: string
}

export default async function RankingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const period: Period = (sp.period === 'monthly' || sp.period === 'all') ? sp.period : 'weekly'
  const metric: Metric = (sp.metric === 'purchases' || sp.metric === 'followers') ? sp.metric : 'sales'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
    profile = data
  }

  const [ranked, trending] = await Promise.all([
    topCreators(period, 30),
    trendingCreators(10),
  ])

  const sorted = [...ranked].sort((a, b) => (b[metric] as number) - (a[metric] as number))
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3, 30)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--mm-text-sub)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
            RANKING
          </p>
          <h1 className="font-serif-display" style={{ fontSize: 30, fontWeight: 500, color: 'var(--mm-ink)' }}>ランキング</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 4 }}>いま推されているクリエイターをチェック</p>
        </div>

        {/* 期間タブ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['weekly', 'monthly', 'all'] as Period[]).map(p => (
            <Link key={p} href={`/rankings?period=${p}&metric=${metric}`}
              style={{
                padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                background: period === p ? 'var(--mm-primary)' : 'white',
                color: period === p ? 'white' : 'var(--mm-text-sub)',
                border: `1px solid ${period === p ? 'var(--mm-primary)' : 'var(--mm-border)'}`,
              }}>
              {p === 'weekly' ? '週間' : p === 'monthly' ? '月間' : '累計'}
            </Link>
          ))}
        </div>

        {/* 指標タブ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {([
            { k: 'sales' as Metric, label: '売上', icon: ShoppingBag },
            { k: 'purchases' as Metric, label: '購入数', icon: Users },
            { k: 'followers' as Metric, label: 'フォロワー増', icon: TrendingUp },
          ]).map(({ k, label, icon: Icon }) => (
            <Link key={k} href={`/rankings?period=${period}&metric=${k}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 18, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                background: metric === k ? 'var(--mm-primary-light)' : 'transparent',
                color: metric === k ? 'var(--mm-primary)' : 'var(--mm-text-muted)',
                border: `1px solid ${metric === k ? 'var(--mm-primary)' : 'var(--mm-border)'}`,
              }}>
              <Icon size={13} />{label}
            </Link>
          ))}
        </div>

        {/* 急上昇セクション */}
        {trending.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Flame size={18} color="#ef4444" />
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>急上昇（24時間）</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {trending.map(c => (
                <Link key={c.id} href={`/creator/${c.username}`} style={{ textDecoration: 'none' }}>
                  <div className="mm-card" style={{ padding: 14, textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: 10 }}>
                      ×{Math.max(1, Math.round(c.followers / 100))}
                    </div>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--mm-primary-light)', margin: '0 auto 10px', overflow: 'hidden' }}>
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 22, fontWeight: 700 }}>{c.display_name[0]}</div>}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>+{c.purchases}件/24h</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* TOP3（表彰台） */}
        {top3.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
              TOP 3 <span style={{ fontSize: 12, color: 'var(--mm-text-muted)', fontWeight: 500 }}>· {METRIC_LABELS[metric]}</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {top3.map((c, i) => (
                <Link key={c.id} href={`/creator/${c.username}`} style={{ textDecoration: 'none' }}>
                  <div className="mm-card" style={{ padding: 20, textAlign: 'center', position: 'relative', borderTop: `4px solid ${RANK_COLORS[i]}` }}>
                    <div style={{ position: 'absolute', top: 10, left: 16, fontSize: 24, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: RANK_COLORS[i] }}>
                      #{i + 1}
                    </div>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--mm-primary-light)', margin: '0 auto 12px', overflow: 'hidden', border: `3px solid ${RANK_COLORS[i]}`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28, fontWeight: 700 }}>{c.display_name[0]}</div>}
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{c.display_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>@{c.username}</p>
                    <div style={{ padding: '8px 0', borderTop: '1px solid var(--mm-border)', marginTop: 8 }}>
                      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--mm-primary)' }}>
                        {metric === 'sales' ? `¥${c[metric].toLocaleString()}` : `${c[metric]}`}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>{METRIC_LABELS[metric]}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 4位以降のテーブル */}
        {rest.length > 0 && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>4位以降</h2>
            <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
              {rest.map((c: CreatorRankRow, i: number) => (
                <Link key={c.id} href={`/creator/${c.username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', textDecoration: 'none', borderBottom: i === rest.length - 1 ? 'none' : '1px solid var(--mm-border)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text-muted)', minWidth: 28 }}>#{i + 4}</span>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                    {c.avatar_url
                      ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 15, fontWeight: 700 }}>{c.display_name[0]}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--mm-primary)' }}>
                      {metric === 'sales' ? `¥${c[metric].toLocaleString()}` : c[metric]}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>{METRIC_LABELS[metric]}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="mm-card" style={{ textAlign: 'center', padding: 'clamp(40px,7vw,64px) 24px', position: 'relative', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', top: 16, left: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, left: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, right: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mm-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
              NO RANKING DATA
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
            </p>
            <p className="font-serif-display" style={{ fontStyle: 'italic', fontSize: 26, color: 'var(--mm-ink)', marginBottom: 12 }}>Nothing to show yet.</p>
            <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginBottom: 24 }}>まだランキングデータがありません</p>
            <Link href="/creators" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--mm-ink)', color: 'white', padding: '12px 24px', borderRadius: 999, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              クリエイターを探す →
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
