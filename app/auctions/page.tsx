import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Gavel, Plus, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'リクエストオークション' }
export const dynamic = 'force-dynamic'

interface AuctionRow {
  id: string
  title: string
  description: string
  category: string | null
  budget_min: number
  budget_max: number
  deadline: string
  status: 'open' | 'closed' | 'awarded' | 'cancelled'
  created_at: string
  user: { id: string; display_name: string; username: string; avatar_url: string | null } | null
}

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms < 0) return '締切'
  const day = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (day > 0) return `あと${day}日`
  const hr = Math.floor(ms / (1000 * 60 * 60))
  return `あと${hr}時間`
}

export default async function AuctionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single() : { data: null }

  const { data: auctionsData } = await supabase
    .from('request_auctions')
    .select('id, title, description, category, budget_min, budget_max, deadline, status, created_at, user:profiles!request_auctions_user_id_fkey(id, display_name, username, avatar_url)')
    .eq('status', 'open')
    .order('deadline', { ascending: true })

  const auctions = (auctionsData ?? []) as unknown as AuctionRow[]

  // 入札数集計
  const ids = auctions.map(a => a.id)
  const bidCounts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: bids } = await supabase.from('auction_bids').select('auction_id').in('auction_id', ids)
    for (const b of bids ?? []) bidCounts.set(b.auction_id, (bidCounts.get(b.auction_id) ?? 0) + 1)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Gavel size={22} color="#7c3aed" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>リクエストオークション</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 22 }}>
          ファンが「こんなコンテンツが欲しい」を投稿、複数のクリエイターが入札する逆オファー型マッチング
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <Link href="/auctions/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#7c3aed', color: 'white', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Plus size={14} />新しいリクエストを投稿
          </Link>
        </div>

        {auctions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🎯</p>
            <p style={{ fontSize: 14 }}>現在受付中のリクエストはありません</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {auctions.map(a => (
              <Link key={a.id} href={`/auctions/${a.id}`} className="mm-card" style={{ padding: 18, textDecoration: 'none', display: 'block' }}>
                {a.category && (
                  <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: 999, marginBottom: 8 }}>{a.category}</span>
                )}
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--mm-text)', marginBottom: 6 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 12 }}>
                  {a.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0 }}>
                    {a.user?.avatar_url ? <img src={a.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{a.user?.display_name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--mm-border)' }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>予算</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>¥{a.budget_min.toLocaleString()}〜¥{a.budget_max.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={10} />締切</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{timeLeft(a.deadline)}</p>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--mm-bg)', borderRadius: 6, fontSize: 11, color: 'var(--mm-text-sub)', textAlign: 'center' }}>
                  💼 {bidCounts.get(a.id) ?? 0}件の入札
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
