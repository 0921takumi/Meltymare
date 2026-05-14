import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { TrendingUp, Users, Package, Crown, Trophy } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [{ data: purchases90 }, { data: signups90 }, { data: contents90 }, { data: topCreators }, { data: topContents }, { data: topFans }] = await Promise.all([
    supabase.from('purchases').select('amount, tip_amount, created_at, content:contents!inner(creator_id)').eq('status', 'completed').gte('created_at', last90.toISOString()),
    supabase.from('profiles').select('created_at, role').gte('created_at', last90.toISOString()),
    supabase.from('contents').select('created_at, is_published').gte('created_at', last90.toISOString()),
    supabase.from('profiles').select('id, display_name, username, avatar_url').eq('role', 'creator'),
    supabase.from('contents').select('id, title, sold_count, price, thumbnail_url, creator:profiles(display_name, username)').eq('is_published', true).order('sold_count', { ascending: false }).limit(10),
    supabase.from('profiles').select('id, display_name, username, avatar_url').eq('role', 'user').limit(500),
  ])

  // 過去90日の週次トレンド
  const weeks: { key: string; label: string; sales: number; orders: number; signups: number; contents: number }[] = []
  for (let i = 12; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i * 7)
    const week = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
    weeks.push({ key: week.toISOString().slice(0, 10), label: `${week.getMonth() + 1}/${week.getDate()}`, sales: 0, orders: 0, signups: 0, contents: 0 })
  }

  const weekKey = (iso: string) => {
    const d = new Date(iso)
    const w = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
    return w.toISOString().slice(0, 10)
  }

  type PRow = { amount?: number; tip_amount?: number; created_at: string; content?: { creator_id?: string } }
  for (const p of (purchases90 ?? []) as PRow[]) {
    const w = weeks.find(x => x.key === weekKey(p.created_at))
    if (w) { w.sales += (p.amount ?? 0) + (p.tip_amount ?? 0); w.orders++ }
  }
  for (const s of signups90 ?? []) {
    const w = weeks.find(x => x.key === weekKey(s.created_at))
    if (w) w.signups++
  }
  for (const c of contents90 ?? []) {
    const w = weeks.find(x => x.key === weekKey(c.created_at))
    if (w) w.contents++
  }

  const maxSales = Math.max(1, ...weeks.map(w => w.sales))

  // クリエイター別売上
  const salesByCreator = new Map<string, { amount: number; orders: number }>()
  for (const p of (purchases90 ?? []) as PRow[]) {
    const cid = p.content?.creator_id
    if (!cid) continue
    const v = salesByCreator.get(cid) ?? { amount: 0, orders: 0 }
    v.amount += (p.amount ?? 0) + (p.tip_amount ?? 0)
    v.orders++
    salesByCreator.set(cid, v)
  }
  const creatorRanking = (topCreators ?? []).map(c => ({
    ...c,
    sales: salesByCreator.get(c.id)?.amount ?? 0,
    orders: salesByCreator.get(c.id)?.orders ?? 0,
  })).sort((a, b) => b.sales - a.sales).slice(0, 10)

  // ファン別購入額
  const supportByUser = new Map<string, number>()
  const { data: allPurchases } = await supabase.from('purchases').select('user_id, amount, tip_amount').eq('status', 'completed')
  for (const p of allPurchases ?? []) {
    supportByUser.set(p.user_id, (supportByUser.get(p.user_id) ?? 0) + (p.amount ?? 0) + (p.tip_amount ?? 0))
  }
  const fanRanking = (topFans ?? []).map(u => ({ ...u, total: supportByUser.get(u.id) ?? 0 })).sort((a, b) => b.total - a.total).slice(0, 10)

  const total90Sales = weeks.reduce((s, w) => s + w.sales, 0)
  const total30Sales = weeks.slice(-4).reduce((s, w) => s + w.sales, 0)
  const total90Signups = weeks.reduce((s, w) => s + w.signups, 0)
  const total30Signups = weeks.slice(-4).reduce((s, w) => s + w.signups, 0)

  return (
    <div className="admin-page">
      <h1 className="admin-h1">📊 分析・KPI</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>過去90日のトレンドとランキング</p>

      {/* サマリーKPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 26 }}>
        <div className="mm-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 700 }}>90日売上</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>¥{total90Sales.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>30日: ¥{total30Sales.toLocaleString()}</p>
        </div>
        <div className="mm-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 700 }}>90日新規登録</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--mm-primary)' }}>{total90Signups}</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>30日: {total30Signups}</p>
        </div>
        <div className="mm-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 700 }}>新規コンテンツ</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed' }}>{contents90?.length ?? 0}</p>
        </div>
        <div className="mm-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 700 }}>稼働中クリエイター</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{salesByCreator.size}</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>過去90日に売上あり</p>
        </div>
      </div>

      {/* トレンドグラフ */}
      <div className="mm-card" style={{ padding: 22, marginBottom: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 週次トレンド (過去13週)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, paddingBottom: 8, borderBottom: '1px solid var(--mm-border)' }}>
          {weeks.map(w => (
            <div key={w.key} style={{ flex: 1, position: 'relative' }} title={`${w.label}: 売上 ¥${w.sales.toLocaleString()} / 注文 ${w.orders} / 登録 ${w.signups} / コンテンツ ${w.contents}`}>
              <div style={{ height: `${(w.sales / maxSales) * 160}px`, background: 'linear-gradient(180deg, var(--mm-primary) 0%, var(--mm-accent) 100%)', borderRadius: '3px 3px 0 0', minHeight: w.sales > 0 ? 4 : 0 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {weeks.map(w => (
            <div key={w.key} style={{ flex: 1, fontSize: 9, color: 'var(--mm-text-muted)', textAlign: 'center' }}>{w.label}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} className="ana-2col">
        {/* クリエイターランキング */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Crown size={15} color="#f59e0b" />売上 Top クリエイター (90日)</h3>
          <div className="mm-card" style={{ overflow: 'hidden' }}>
            {creatorRanking.map((c, i) => (
              <Link key={c.id} href={`/creator/${c.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < creatorRanking.length - 1 ? '1px solid var(--mm-border)' : 'none', textDecoration: 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--mm-text-muted)', width: 24, textAlign: 'center' }}>{i + 1}</span>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden' }}>
                  {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700 }}>{c.display_name}</p>
                  <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>{c.orders}件購入</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>¥{c.sales.toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ファンランキング */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={15} color="#a855f7" />ガチ推しユーザー Top10</h3>
          <div className="mm-card" style={{ overflow: 'hidden' }}>
            {fanRanking.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < fanRanking.length - 1 ? '1px solid var(--mm-border)' : 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? '#a855f7' : 'var(--mm-text-muted)', width: 24, textAlign: 'center' }}>{i + 1}</span>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden' }}>
                  {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{u.display_name}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>¥{u.total.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 人気コンテンツ */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Package size={15} />人気コンテンツ Top10</h3>
          <div className="mm-card" style={{ overflow: 'hidden' }}>
            {(topContents as Array<{ id: string; title: string; sold_count: number; price: number; thumbnail_url: string | null; creator: { display_name: string } | null }> | null ?? []).map((c, i) => (
              <Link key={c.id} href={`/contents/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < (topContents?.length ?? 0) - 1 ? '1px solid var(--mm-border)' : 'none', textDecoration: 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? 'var(--mm-primary)' : 'var(--mm-text-muted)', width: 24, textAlign: 'center' }}>{i + 1}</span>
                <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                  {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                  <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>{c.creator?.display_name} · ¥{c.price.toLocaleString()}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{c.sold_count}件</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1100px) {
          .ana-2col { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
