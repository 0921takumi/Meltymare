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
    <div style={{ padding: '32px 32px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>オークション管理</h1>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 4 }}>{auctions.length}件 · 予算合計 ¥{totalBudget.toLocaleString()}</p>
      </div>

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
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
          <Gavel size={36} />
          <p style={{ fontSize: 13, marginTop: 8 }}>該当するオークションがありません</p>
        </div>
      ) : (
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          <div className="mm-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--mm-bg)' }}>
                  {['タイトル', '依頼者', '予算', '入札', '締切', 'ステータス'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auctions.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                    <td style={{ padding: '11px 14px', maxWidth: 280 }}>
                      <Link href={`/auctions/${a.id}`} style={{ color: 'var(--mm-primary)', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>{a.title}</Link>
                      {a.category && <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 2 }}>{a.category}</p>}
                    </td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{a.user?.display_name ?? '—'}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>¥{a.budget_min.toLocaleString()}〜¥{a.budget_max.toLocaleString()}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, textAlign: 'center' }}>{a.bid_count ?? 0}</td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--mm-text-sub)' }}>
                      <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                      {new Date(a.deadline).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: a.status === 'open' ? '#dbeafe' : a.status === 'awarded' ? '#d1fae5' : '#f3f4f6',
                        color: a.status === 'open' ? '#1e40af' : a.status === 'awarded' ? '#065f46' : '#6b7280',
                      }}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
