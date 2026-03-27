import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import ContentCard from '@/components/ui/ContentCard'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let myProfile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    myProfile = data
  }

  // クリエイター取得
  const { data: creator } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('role', 'creator')
    .single()
  if (!creator) return notFound()

  // コンテンツ取得
  const { data: contents } = await supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, avatar_url)')
    .eq('creator_id', creator.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // 購入済みIDリスト
  let purchasedIds: string[] = []
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('content_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
    purchasedIds = purchases?.map(p => p.content_id) ?? []
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={myProfile} />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>

        {/* クリエイターヘッダー */}
        <div className="mm-card" style={{ padding: '32px 36px', marginBottom: 36, display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          {/* アバター */}
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, flexShrink: 0, overflow: 'hidden' }}>
            {creator.avatar_url
              ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '👤'}
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{creator.display_name}</h1>
            <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 12 }}>@{creator.username}</p>
            {creator.bio && (
              <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 14 }}>{creator.bio}</p>
            )}
            {/* SNSリンク */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {creator.twitter_url && (
                <a href={creator.twitter_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--mm-primary)', fontWeight: 600, textDecoration: 'none', padding: '5px 12px', border: '1px solid var(--mm-border)', borderRadius: 20 }}>
                  <ExternalLink size={13} /> X (Twitter)
                </a>
              )}
              {creator.instagram_url && (
                <a href={creator.instagram_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--mm-primary)', fontWeight: 600, textDecoration: 'none', padding: '5px 12px', border: '1px solid var(--mm-border)', borderRadius: 20 }}>
                  <ExternalLink size={13} /> Instagram
                </a>
              )}
              {creator.tiktok_url && (
                <a href={creator.tiktok_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--mm-primary)', fontWeight: 600, textDecoration: 'none', padding: '5px 12px', border: '1px solid var(--mm-border)', borderRadius: 20 }}>
                  🎵 TikTok
                </a>
              )}
            </div>
          </div>

          {/* 統計 */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--mm-primary)' }}>{contents?.length ?? 0}</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>コンテンツ</p>
          </div>
        </div>

        {/* コンテンツ一覧 */}
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>コンテンツ一覧</h2>
        {!contents || contents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mm-text-muted)' }}>
            <p>まだコンテンツがありません</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {contents.map((content: any) => (
              <ContentCard key={content.id} content={content} isPurchased={purchasedIds.includes(content.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
