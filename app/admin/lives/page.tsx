import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Radio, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Stream {
  id: string
  title: string
  thumbnail_url: string | null
  scheduled_at: string
  ends_at: string | null
  is_premium: boolean
  premium_price: number | null
  status: string
  viewer_peak: number
  creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  created_at: string
}

export default async function AdminLivesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const status = sp.status ?? 'all'

  let query = supabase
    .from('live_streams')
    .select('*, creator:profiles!live_streams_creator_id_fkey(id, display_name, username, avatar_url)')
    .order('scheduled_at', { ascending: false })
    .limit(100)
  if (status !== 'all') query = query.eq('status', status)

  const { data } = await query
  const streams = (data ?? []) as unknown as Stream[]

  const counts = { all: 0, live: 0, scheduled: 0, ended: 0 }
  const { data: allStreams } = await supabase.from('live_streams').select('status')
  for (const s of allStreams ?? []) {
    counts.all++
    if (s.status in counts) counts[s.status as keyof typeof counts]++
  }

  return (
    <div className="admin-page">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>ライブ配信管理</h1>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 4 }}>すべての配信 / 緊急停止</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'すべて', count: counts.all },
          { key: 'live', label: '🔴 配信中', count: counts.live },
          { key: 'scheduled', label: '予定', count: counts.scheduled },
          { key: 'ended', label: '終了', count: counts.ended },
        ].map(t => (
          <Link key={t.key} href={`/admin/lives?status=${t.key}`} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: status === t.key ? 'var(--mm-primary)' : 'white',
            color: status === t.key ? 'white' : 'var(--mm-text-sub)',
            border: status === t.key ? 'none' : '1px solid var(--mm-border)',
            textDecoration: 'none',
          }}>{t.label} <span style={{ marginLeft: 4, opacity: 0.7 }}>({t.count})</span></Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {streams.map(s => (
          <div key={s.id} className="mm-card" style={{ overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative' }}>
              {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 32 }}>📺</div>}
              {s.status === 'live' && (
                <span style={{ position: 'absolute', top: 10, left: 10, background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />LIVE
                </span>
              )}
              {s.is_premium && (
                <span style={{ position: 'absolute', top: 10, right: 10, background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                  ¥{s.premium_price?.toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
              <Link href={`/creator/${s.creator?.username}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textDecoration: 'none' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)' }}>
                  {s.creator?.avatar_url ? <img src={s.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <p style={{ fontSize: 11, color: 'var(--mm-text-sub)' }}>{s.creator?.display_name}</p>
              </Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 10, color: 'var(--mm-text-muted)' }}>
                <span>🗓 {new Date(s.scheduled_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {s.viewer_peak > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={10} />{s.viewer_peak}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <Link href={`/live/${s.id}`} style={{ flex: 1, padding: '6px 10px', background: 'transparent', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 11, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>表示</Link>
                {s.status === 'live' && (
                  <form action="/api/admin-live" method="POST" style={{ flex: 1 }}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="action" value="force_stop" />
                    <button type="submit" style={{ width: '100%', padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>緊急停止</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mm-text-muted)' }}>
          <Radio size={36} />
          <p style={{ fontSize: 13, marginTop: 8 }}>該当する配信がありません</p>
        </div>
      )}
    </div>
  )
}
