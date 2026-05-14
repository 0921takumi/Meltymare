import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import ContentCard from '@/components/ui/ContentCard'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import FollowButton from './FollowButton'
import TopFans from './TopFans'
import SubscribeButton from './SubscribeButton'
import Link from 'next/link'
import type { Metadata } from 'next'
import { topFans, userRankForCreator } from '@/lib/rankings'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()
  const { data: creator } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('username', username)
    .eq('role', 'creator')
    .single()
  if (!creator) return { title: 'クリエイターが見つかりません' }
  const desc = creator.bio ?? `${creator.display_name} のクリエイターページ`
  return {
    title: creator.display_name,
    description: desc,
    openGraph: {
      title: `${creator.display_name} | My Focus`,
      description: desc,
      images: creator.avatar_url ? [{ url: creator.avatar_url }] : [],
    },
    twitter: { card: 'summary_large_image', title: creator.display_name, description: desc },
  }
}

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

  const fans = await topFans(creator.id, 10)
  const myFanRank = user ? await userRankForCreator(user.id, creator.id) : null

  // ストーリー (24h以内)
  const { data: storiesData } = await supabase
    .from('stories')
    .select('id, media_url, media_type, created_at')
    .eq('creator_id', creator.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(6)
  const stories = storiesData ?? []

  // サブスクプラン
  const { data: plansData } = await supabase
    .from('subscription_plans')
    .select('id, name, description, monthly_price, benefits, badge_emoji, badge_color, member_count')
    .eq('creator_id', creator.id)
    .eq('is_active', true)
    .order('monthly_price', { ascending: true })
  const plans = plansData ?? []

  // 自分の購読チェック
  let mySubscriptions = new Set<string>()
  if (user) {
    const { data: mySubs } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('creator_id', creator.id)
      .eq('status', 'active')
    mySubscriptions = new Set((mySubs ?? []).map(s => s.plan_id))
  }

  // 配信予定 / ライブ中
  const { data: liveData } = await supabase
    .from('live_streams')
    .select('id, title, scheduled_at, status, thumbnail_url')
    .eq('creator_id', creator.id)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true })
    .limit(3)
  const upcomingStreams = liveData ?? []

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

        {/* あなたのファン順位（ログイン時のみ） */}
        {myFanRank && (
          <div className="mm-card" style={{ padding: '14px 18px', marginBottom: 20, background: 'linear-gradient(135deg, #fff7ed, white)', border: '1px solid #fed7aa' }}>
            <p style={{ fontSize: 12, color: '#9a3412', marginBottom: 2, fontWeight: 600 }}>あなたは {creator.display_name} さんの</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}>
              #{myFanRank.rank} <span style={{ fontSize: 13, color: 'var(--mm-text-muted)', fontWeight: 500 }}>/ {myFanRank.of} ファン中</span>
            </p>
          </div>
        )}

        {/* ストーリー (24h) */}
        {stories.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✨ ストーリー</span>
              <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 400 }}>24時間で消える</span>
            </h2>
            <Link href={`/stories/${creator.id}`} style={{ display: 'flex', gap: 8, textDecoration: 'none', overflowX: 'auto' }}>
              {stories.map(s => (
                <div key={s.id} style={{ flexShrink: 0, width: 90, height: 160, borderRadius: 10, overflow: 'hidden', background: '#000', position: 'relative', border: '2px solid #a855f7' }}>
                  {s.media_type === 'image'
                    ? <img src={s.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <video src={s.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              ))}
            </Link>
          </section>
        )}

        {/* 配信予定 / ライブ中 */}
        {upcomingStreams.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📡 ライブ配信</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingStreams.map(s => (
                <Link key={s.id} href={`/live/${s.id}`} className="mm-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', borderLeft: s.status === 'live' ? '4px solid #dc2626' : '4px solid var(--mm-primary)' }}>
                  {s.thumbnail_url && <img src={s.thumbnail_url} alt="" style={{ width: 80, height: 45, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                    <p style={{ fontSize: 11, color: s.status === 'live' ? '#dc2626' : 'var(--mm-text-muted)', fontWeight: s.status === 'live' ? 700 : 400, marginTop: 2 }}>
                      {s.status === 'live' ? '🔴 配信中' : `🗓 ${new Date(s.scheduled_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}〜`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* サブスクプラン */}
        {plans.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💎 メンバーシップ</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {plans.map(p => {
                const subscribed = mySubscriptions.has(p.id)
                return (
                  <div key={p.id} className="mm-card" style={{ padding: 16, borderTop: `4px solid ${p.badge_color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{p.badge_emoji}</span>
                      <p style={{ fontSize: 14, fontWeight: 700, color: p.badge_color }}>{p.name}</p>
                    </div>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>¥{p.monthly_price.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--mm-text-muted)' }}>/月</span></p>
                    {p.description && <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginTop: 6, lineHeight: 1.5 }}>{p.description}</p>}
                    {Array.isArray(p.benefits) && p.benefits.length > 0 && (
                      <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 11, color: 'var(--mm-text-sub)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {p.benefits.slice(0, 3).map((b: string, i: number) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 8 }}>👥 {p.member_count}名</p>
                    <form action="/api/subscribe" method="POST" style={{ marginTop: 10 }}>
                      <input type="hidden" name="plan_id" value={p.id} />
                      {subscribed ? (
                        <div style={{ padding: '8px 12px', background: '#d1fae5', color: '#065f46', borderRadius: 6, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>加入中</div>
                      ) : !user ? (
                        <Link href="/auth/login" style={{ display: 'block', padding: '8px 12px', background: p.badge_color, color: 'white', borderRadius: 999, fontSize: 12, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>ログインして加入</Link>
                      ) : (
                        <SubscribeButton planId={p.id} color={p.badge_color} />
                      )}
                    </form>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 推されランキング */}
        <TopFans fans={fans} highlightUserId={user?.id} />

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
