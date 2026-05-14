import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LiveChat from './LiveChat'

export const dynamic = 'force-dynamic'

export default async function LiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).single() : { data: null }

  const { data: stream } = await supabase
    .from('live_streams')
    .select('*, creator:profiles!live_streams_creator_id_fkey(id, username, display_name, avatar_url, bio)')
    .eq('id', id)
    .single()

  if (!stream) notFound()

  const { data: messagesData } = await supabase
    .from('live_chat_messages')
    .select('id, body, is_super_chat, super_chat_amount, created_at, user:profiles!live_chat_messages_user_id_fkey(id, display_name, avatar_url)')
    .eq('stream_id', id)
    .order('created_at', { ascending: true })
    .limit(100)

  const isLive = stream.status === 'live'
  const isOwner = user?.id === stream.creator_id

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} className="live-grid">
        <div>
          {/* プレーヤー */}
          <div style={{ aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            {stream.thumbnail_url ? (
              <img src={stream.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isLive ? 0.4 : 1 }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 48 }}>📺</div>
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {isLive ? (
                <>
                  <span style={{ background: '#dc2626', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />LIVE 配信中
                  </span>
                  <p style={{ fontSize: 14, opacity: 0.8 }}>※ 実際の配信プレーヤーは外部 (YouTube Live / Twitch など) を埋め込み予定</p>
                  {stream.stream_url && (
                    <a href={stream.stream_url} target="_blank" rel="noreferrer" style={{ background: 'white', color: '#000', padding: '8px 18px', borderRadius: 999, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>配信を見る →</a>
                  )}
                </>
              ) : stream.status === 'scheduled' ? (
                <>
                  <span style={{ background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>配信予定</span>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{new Date(stream.scheduled_at).toLocaleString('ja-JP')}〜</p>
                </>
              ) : (
                <span style={{ background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 999, fontSize: 12 }}>配信終了</span>
              )}
            </div>
          </div>

          {/* タイトル + クリエイター */}
          <div style={{ marginTop: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>{stream.title}</h1>
            <Link href={`/creator/${stream.creator?.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, textDecoration: 'none' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)' }}>
                {stream.creator?.avatar_url ? <img src={stream.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700 }}>{stream.creator?.display_name}</p>
                <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{stream.creator?.username}</p>
              </div>
            </Link>
            {stream.description && (
              <p style={{ marginTop: 14, fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{stream.description}</p>
            )}
          </div>
        </div>

        {/* チャット */}
        <div className="mm-card" style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--mm-border)' }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>💬 ライブチャット</p>
          </div>
          <LiveChat
            streamId={id}
            initialMessages={(messagesData ?? []) as unknown as Parameters<typeof LiveChat>[0]['initialMessages']}
            currentUserId={user?.id ?? null}
            isOwner={isOwner}
            isLive={isLive}
          />
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .live-grid { grid-template-columns: 1fr 360px !important; }
        }
      `}</style>
    </div>
  )
}
