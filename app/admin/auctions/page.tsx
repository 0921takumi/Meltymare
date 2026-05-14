import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Gavel, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface AuctionRow {
  id: string
  title: string
  description: string
  category: string | null
  budget_min: number
  budget_max: number
  deadline: string
  status: string
  created_at: string
  user: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  bid_count?: number
}

export default async function AdminAuctionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const status = sp.status ?? 'all'

  let query = supabase
    .from('request_auctions')
    .select('*, user:profiles!request_auctions_user_id_fkey(id, display_name, username, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status !== 'all') query = query.eq('status', status)

  const { data } = await query
  const auctions = (data ?? []) as unknown as AuctionRow[]

  // 入札数集計
  const ids = auctions.map(a => a.id)
  if (ids.length > 0) {
    const { data: bids } = await supabase.from('auction_bids').select('auction_id').in('auction_id', ids)
    const counts = new Map<string, number>()
    for (const b of bids ?? []) counts.set(b.auction_id, (counts.get(b.auction_id) ?? 0) + 1)
    auctions.forEach(a => { a.bid_count = counts.get(a.id) ?? 0 })
  }

  const totalBudget = auctions.reduce((s, a) => s + a.budget_max, 0)

  return (
    <div className="admin-page">
      <h1 className="admin-h1">オークション管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>{auctions.length}件 · 予算合計 ¥{totalBudget.toLocaleString()}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'すべて' },
          { key: 'open', label: '受付中' },
          { key: 'awarded', label: '成立' },
          { key: 'closed', label: '締切' },
          { key: 'cancelled', label: '中止' },
        ].map(t => (
          <Link key={t.key} href={`/admin/auctions?status=${t.key}`} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: status === t.key ? 'var(--mm-primary)' : 'white',
            color: status === t.key ? 'white' : 'var(--mm-text-sub)',
            border: status === t.key ? 'none' : '1px solid var(--mm-border)',
            textDecoration: 'none',
          }}>{t.label}</Link>
        ))}
      </div>

      {auctions.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12, textAlign: 'center', padding: '64px 24px', color: 'var(--mm-text-muted)' }}>
          <Gavel size={36} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: 13, marginTop: 12 }}>該当するオークションがありません</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>タイトル</th>
                <th>依頼者</th>
                <th>予算</th>
                <th className="num">入札</th>
                <th>締切</th>
                <th>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map(a => (
                <tr key={a.id}>
                  <td data-label="タイトル" style={{ maxWidth: 280 }}>
                    <Link href={`/auctions/${a.id}`} style={{ color: 'var(--mm-ink)', textDecoration: 'none', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--mm-border)' }}>{a.title}</Link>
                    {a.category && <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{a.category}</p>}
                  </td>
                  <td data-label="依頼者" style={{ color: 'var(--mm-text-sub)' }}>{a.user?.display_name ?? '—'}</td>
                  <td data-label="予算" style={{ fontWeight: 700, color: 'var(--mm-ink)', fontVariantNumeric: 'tabular-nums' }}>¥{a.budget_min.toLocaleString()}〜¥{a.budget_max.toLocaleString()}</td>
                  <td data-label="入札" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>{a.bid_count ?? 0}</td>
                  <td data-label="締切" style={{ fontSize: 11, color: 'var(--mm-text-sub)', fontVariantNumeric: 'tabular-nums' }}>
                    <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    {new Date(a.deadline).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </td>
                  <td data-label="ステータス">
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                      background: a.status === 'open' ? '#dbeafe' : a.status === 'awarded' ? '#d1fae5' : '#f3f4f6',
                      color: a.status === 'open' ? '#1e40af' : a.status === 'awarded' ? '#065f46' : '#6b7280',
                    }}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
