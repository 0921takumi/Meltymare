import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import ContentCard from '@/components/ui/ContentCard'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import FollowButton from './FollowButton'
import TopFans from './TopFans'
import SubscribeButton from './SubscribeButton'
import TipButton from '@/components/TipButton'
import Link from 'next/link'
import type { Metadata } from 'next'
import { topFans, userRankForCreator } from '@/lib/rankings'
import { FEATURES } from '@/lib/config'
import { getVoteCounts } from '@/lib/polls'
import PollCard from '@/components/poll/PollCard'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()
  const { data: creator } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('username', username)
    .eq('role', 'creator')
    .single()
  if (!creator) return { title: 'クリエイターが見つかりません', robots: { index: false, follow: false } }
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
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
    myProfile = data
  }

  const { data: creator } = await supabase
    .from('profiles')
    .select(PROFILE_PUBLIC_SELECT)
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

  // ストーリー (24h以内) — 機能停止中(FEATURES.stories=false)はクエリ自体をスキップ
  let stories: { id: string; media_url: string; media_type: string; created_at: string }[] = []
  if (FEATURES.stories) {
    const { data: storiesData } = await supabase
      .from('stories')
      .select('id, media_url, media_type, created_at')
      .eq('creator_id', creator.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(6)
    stories = storiesData ?? []
  }

  // サブスクプラン — 機能停止中(FEATURES.subscriptions=false)はクエリ自体をスキップ
  let plans: {
    id: string; name: string; description: string | null; monthly_price: number;
    benefits: string[] | null; badge_emoji: string; badge_color: string; member_count: number
  }[] = []
  if (FEATURES.subscriptions) {
    const { data: plansData } = await supabase
      .from('subscription_plans')
      .select('id, name, description, monthly_price, benefits, badge_emoji, badge_color, member_count')
      .eq('creator_id', creator.id)
      .eq('is_active', true)
      .order('monthly_price', { ascending: true })
    plans = plansData ?? []
  }

  // 自分の購読チェック — 機能停止中(FEATURES.subscriptions=false)はスキップ
  let mySubscriptions = new Set<string>()
  if (FEATURES.subscriptions && user) {
    const { data: mySubs } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('creator_id', creator.id)
      .eq('status', 'active')
    mySubscriptions = new Set((mySubs ?? []).map(s => s.plan_id))
  }

  // 配信予定 / ライブ中 — 機能停止中(FEATURES.live=false)はクエリ自体をスキップ
  let upcomingStreams: { id: string; title: string; scheduled_at: string; status: string; thumbnail_url: string | null }[] = []
  if (FEATURES.live) {
    const { data: liveData } = await supabase
      .from('live_streams')
      .select('id, title, scheduled_at, status, thumbnail_url')
      .eq('creator_id', creator.id)
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true })
      .limit(3)
    upcomingStreams = liveData ?? []
  }

  // アンケート（公開中）
  const { data: pollsData } = await supabase
    .from('polls')
    .select('id, question, options, status, created_at')
    .eq('creator_id', creator.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(10)
  const openPolls = pollsData ?? []
  const pollOptionCounts: Record<string, number> = {}
  for (const p of openPolls) pollOptionCounts[p.id] = Array.isArray(p.options) ? p.options.length : 0
  const pollCounts = await getVoteCounts(pollOptionCounts)
  const myPollVotes: Record<string, number> = {}
  if (user && openPolls.length > 0) {
    const { data: pv } = await supabase
      .from('poll_votes')
      .select('poll_id, option_index')
      .eq('user_id', user.id)
      .in('poll_id', openPolls.map((p) => p.id))
    for (const v of pv ?? []) myPollVotes[v.poll_id] = v.option_index
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={myProfile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* クリエイターヘッダー（エディトリアル） */}
        <div className="mm-card" style={{ padding: '28px', marginBottom: 32 }}>
          <div className="mm-creator-profile-header">
            {/* アバター（フォトカード風） */}
            <div style={{
              width: 108, height: 108, borderRadius: 10,
              background: 'var(--mm-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
              boxShadow: '0 4px 16px -6px rgba(31,26,21,0.16)',
            }}>
              {creator.avatar_url
                ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span className="font-serif-display" style={{ fontSize: 56, fontWeight: 500, fontStyle: 'italic', color: 'var(--mm-primary)' }}>{creator.display_name[0]}</span>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
                    Creator
                  </p>
                  <h1 className="font-serif-display" style={{
                    fontSize: 'clamp(28px, 4vw, 38px)',
                    fontWeight: 500, fontStyle: 'italic',
                    color: 'var(--mm-ink)', lineHeight: 1.1,
                    marginBottom: 4, letterSpacing: '0.01em',
                  }}>{creator.display_name}</h1>
                  <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', letterSpacing: '0.04em', marginBottom: 14 }}>@{creator.username}</p>
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
                <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.85, marginBottom: 18, maxWidth: 560 }}>{creator.bio}</p>
              )}

              {/* SNSリンク */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {creator.twitter_url && (
                  <a href={creator.twitter_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mm-text)', fontWeight: 600, textDecoration: 'none', padding: '6px 14px', border: '1px solid var(--mm-border)', borderRadius: 999 }}>
                    <ExternalLink size={12} /> X
                  </a>
                )}
                {creator.instagram_url && (
                  <a href={creator.instagram_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mm-text)', fontWeight: 600, textDecoration: 'none', padding: '6px 14px', border: '1px solid var(--mm-border)', borderRadius: 999 }}>
                    <ExternalLink size={12} /> Instagram
                  </a>
                )}
                {creator.tiktok_url && (
                  <a href={creator.tiktok_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mm-text)', fontWeight: 600, textDecoration: 'none', padding: '6px 14px', border: '1px solid var(--mm-border)', borderRadius: 999 }}>
                    🎵 TikTok
                  </a>
                )}
              </div>

              {/* アクションボタン群（チップ） */}
              {(!user || user.id !== creator.id) && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <TipButton creatorId={creator.id} creatorName={creator.display_name} isLoggedIn={!!user} />
                </div>
              )}
            </div>

            {/* 統計（誌面風数値） */}
            <div style={{ flexShrink: 0, display: 'flex', gap: 24, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p className="font-serif-display" style={{ fontSize: 32, fontWeight: 600, color: 'var(--mm-ink)', lineHeight: 1 }}>{contents?.length ?? 0}</p>
                <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6, fontWeight: 600 }}>Items</p>
              </div>
              <div style={{ width: 1, height: 36, background: 'var(--mm-border)' }} />
              <div style={{ textAlign: 'center' }}>
                <p className="font-serif-display" style={{ fontSize: 32, fontWeight: 600, color: 'var(--mm-ink)', lineHeight: 1 }}>{totalSold}</p>
                <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6, fontWeight: 600 }}>Sales</p>
              </div>
              <div style={{ width: 1, height: 36, background: 'var(--mm-border)' }} />
              <div style={{ textAlign: 'center' }}>
                <p className="font-serif-display" style={{ fontSize: 32, fontWeight: 600, color: 'var(--mm-ink)', lineHeight: 1 }}>{followerCount ?? 0}</p>
                <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6, fontWeight: 600 }}>Fans</p>
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
        {FEATURES.stories && stories.length > 0 && (
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
        {FEATURES.live && upcomingStreams.length > 0 && (
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

        {/* アンケート */}
        {openPolls.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📊 アンケート</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {openPolls.map((p) => (
                <PollCard
                  key={p.id}
                  poll={{ id: p.id, question: p.question, options: (p.options ?? []) as string[], status: p.status === 'closed' ? 'closed' : 'open' }}
                  counts={pollCounts[p.id] ?? []}
                  userVotedIndex={myPollVotes[p.id] ?? null}
                  isLoggedIn={!!user}
                />
              ))}
            </div>
          </section>
        )}

        {/* サブスクプラン（機能フラグで停止中はUI非表示） */}
        {FEATURES.subscriptions && plans.length > 0 && (
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
