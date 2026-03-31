import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import ContentCard from '@/components/ui/ContentCard'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import FollowButton from './FollowButton'
import Link from 'next/link'

export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let myProfile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    myProfile = data
  }

  const { data: creator } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('role', 'creator')
    .single()
  if (!creator) return notFound()

  const { data: contents } = await supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, avatar_url)')
    .eq('creator_id', creator.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  let purchasedIds: string[] = []
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases').select('content_id')
      .eq('user_id', user.id).eq('status', 'completed')
    purchasedIds = purchases?.map(p => p.content_id) ?? []
  }

  // フォロワー数 & フォロー済みチェック
  const { count: followerCount } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creator.id)

  let isFollowing = false
  if (user) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('creator_id', creator.id)
      .single()
    isFollowing = !!followRow
  }

  const totalSold = contents?.reduce((s: number, c: any) => s + (c.sold_count ?? 0), 0) ?? 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={myProfile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* クリエイターヘッダー */}
        <div className="mm-card" style={{ padding: '24px', marginBottom: 28 }}>
          <div className="mm-creator-profile-header">
            {/* アバター */}
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, flexShrink: 0, overflow: 'hidden', border: '3px solid white', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
              {creator.avatar_url
                ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '👤'}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{creator.display_name}</h1>
                  <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 10 }}>@{creator.username}</p>
                </div>
                {/* フォローボタン（自分以外） */}
                {(!user || user.id !== creator.id) && (
                  <FollowButton
                    creatorId={creator.id}
                    isFollowing={isFollowing}
                    isLoggedIn={!!user}
                    followerCount={followerCount ?? 0}
                  />
                )}
              </div>

              {creator.bio && (
                <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 14 }}>{creator.bio}</p>
              )}

              {/* SNSリンク */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
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

              {/* 販売リクエストボタン */}
              {user && user.id !== creator.id && (
                <Link href={`/requests/new?creator_id=${creator.id}`}
                  style={{ display: 'inline-block', padding: '9px 20px', background: 'var(--mm-primary-light)', color: 'var(--mm-primary)', border: '1px solid var(--mm-primary)', borderRadius: 20, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  ✉️ カスタムリクエストを送る
                </Link>
              )}
            </div>

            {/* 統計 */}
            <div style={{ flexShrink: 0, display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--mm-primary)' }}>{contents?.length ?? 0}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>コンテンツ</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>{totalSold}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>販売数</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#ec4899' }}>{followerCount ?? 0}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>フォロワー</p>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツ一覧 */}
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>コンテンツ一覧</h2>
        {!contents || contents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mm-text-muted)' }}>
            <p>まだコンテンツがありません</p>
          </div>
        ) : (
          <div className="mm-content-grid">
            {contents.map((content: any) => (
              <ContentCard key={content.id} content={content} isPurchased={purchasedIds.includes(content.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
