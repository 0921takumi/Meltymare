import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Gavel, Clock } from 'lucide-react'
import BidForm from './BidForm'

export const dynamic = 'force-dynamic'

interface BidRow {
  id: string
  bid_amount: number
  message: string
  estimated_days: number
  created_at: string
  creator: { id: string; display_name: string; username: string; avatar_url: string | null; bio: string | null } | null
}

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).single() : { data: null }

  const { data: auction } = await supabase
    .from('request_auctions')
    .select('*, user:profiles!request_auctions_user_id_fkey(id, display_name, username, avatar_url)')
    .eq('id', id)
    .single()
  if (!auction) notFound()

  const { data: bidsData } = await supabase
    .from('auction_bids')
    .select('id, bid_amount, message, estimated_days, created_at, creator:profiles!auction_bids_creator_id_fkey(id, display_name, username, avatar_url, bio)')
    .eq('auction_id', id)
    .order('bid_amount', { ascending: true })

  const bids = (bidsData ?? []) as unknown as BidRow[]
  const isOwner = user?.id === auction.user_id
  const canBid = !isOwner && profile?.role === 'creator' && auction.status === 'open'
  const myBid = bids.find(b => b.creator?.id === user?.id)
  const deadline = new Date(auction.deadline)
  const expired = deadline < new Date()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/auctions" style={{ fontSize: 12, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← オークション一覧</Link>

        <div className="mm-card" style={{ padding: 24, marginTop: 14 }}>
          {auction.category && (
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '3px 10px', borderRadius: 999, marginBottom: 10 }}>{auction.category}</span>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{auction.title}</h1>

          <Link href={`/${auction.user?.username ? `creator/${auction.user.username}` : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)' }}>
              {auction.user?.avatar_url ? <img src={auction.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </div>
            <p style={{ fontSize: 12, color: 'var(--mm-text-sub)' }}>{auction.user?.display_name}</p>
          </Link>

          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--mm-text)', whiteSpace: 'pre-wrap', marginBottom: 18 }}>
            {auction.description}
          </p>

          <div style={{ display: 'flex', gap: 18, padding: '14px 16px', background: 'var(--mm-bg)', borderRadius: 8, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>予算</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#7c3aed' }}>¥{auction.budget_min.toLocaleString()}〜¥{auction.budget_max.toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>締切</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: expired ? '#9ca3af' : '#dc2626' }}>
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                {deadline.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>入札数</p>
              <p style={{ fontSize: 16, fontWeight: 700 }}>{bids.length}件</p>
            </div>
          </div>
        </div>

        {canBid && !myBid && !expired && (
          <div className="mm-card" style={{ padding: 22, marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Gavel size={18} color="#7c3aed" />
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>入札する</h2>
            </div>
            <BidForm auctionId={id} budgetMin={auction.budget_min} budgetMax={auction.budget_max} />
          </div>
        )}

        {myBid && (
          <div className="mm-card" style={{ padding: 16, marginTop: 18, border: '2px solid #7c3aed' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>あなたの入札</p>
            <p style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>¥{myBid.bid_amount.toLocaleString()} / {myBid.estimated_days}日</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginTop: 8 }}>{myBid.message}</p>
          </div>
        )}

        {/* 入札一覧 */}
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>入札一覧 ({bids.length})</h2>
          {bids.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mm-text-muted)', fontSize: 13 }}>まだ入札がありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bids.map(b => (
                <div key={b.id} className="mm-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Link href={`/creator/${b.creator?.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)' }}>
                        {b.creator?.avatar_url ? <img src={b.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>{b.creator?.display_name}</p>
                        <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>@{b.creator?.username}</p>
                      </div>
                    </Link>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#7c3aed' }}>¥{b.bid_amount.toLocaleString()}</p>
                      <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>{b.estimated_days}日で納品</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
