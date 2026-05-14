import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Radio, Calendar } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ライブ配信' }
export const dynamic = 'force-dynamic'

interface StreamRow {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  scheduled_at: string
  is_premium: boolean
  premium_price: number | null
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  viewer_peak: number
  creator: { id: string; username: string; display_name: string; avatar_url: string | null } | null
}

export default async function LivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).single() : { data: null }

  const { data: streamsData } = await supabase
    .from('live_streams')
    .select('id, title, description, thumbnail_url, scheduled_at, is_premium, premium_price, status, viewer_peak, creator:profiles!live_streams_creator_id_fkey(id, username, display_name, avatar_url)')
    .in('status', ['live', 'scheduled'])
    .order('scheduled_at', { ascending: true })

  const streams = (streamsData ?? []) as unknown as StreamRow[]
  const live = streams.filter(s => s.status === 'live')
  const scheduled = streams.filter(s => s.status === 'scheduled')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <Radio size={22} color="#dc2626" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>ライブ配信</h1>
        </div>

        {live.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', animation: 'pulse 2s infinite' }} />LIVE
              </span>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>配信中</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {live.map(s => <StreamCard key={s.id} stream={s} live />)}
            </div>
          </section>
        )}

        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Calendar size={18} color="var(--mm-primary)" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>配信予定</h2>
            <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>{scheduled.length}件</span>
          </div>
          {scheduled.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mm-text-muted)' }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>📡</p>
              <p style={{ fontSize: 13 }}>予定されている配信はありません</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {scheduled.map(s => <StreamCard key={s.id} stream={s} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StreamCard({ stream, live }: { stream: StreamRow; live?: boolean }) {
  return (
    <Link href={`/live/${stream.id}`} className="mm-card" style={{ overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
      <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative' }}>
        {stream.thumbnail_url ? (
          <img src={stream.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 32 }}>📺</div>
        )}
        {live && (
          <span style={{ position: 'absolute', top: 10, left: 10, background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />LIVE
          </span>
        )}
        {stream.is_premium && (
          <span style={{ position: 'absolute', top: 10, right: 10, background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
            ¥{stream.premium_price?.toLocaleString()} PREMIUM
          </span>
        )}
        {live && (
          <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4 }}>
            👁 {stream.viewer_peak.toLocaleString()}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0 }}>
            {stream.creator?.avatar_url ? <img src={stream.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </div>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.creator?.display_name}</p>
        </div>
        {!live && (
          <p style={{ fontSize: 11, color: 'var(--mm-primary)', marginTop: 6, fontWeight: 600 }}>
            🗓 {new Date(stream.scheduled_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}〜
          </p>
        )}
      </div>
    </Link>
  )
}
