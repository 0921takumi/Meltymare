import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, UserPlus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'フォロー中のクリエイター' }
export const dynamic = 'force-dynamic'

interface FollowRow {
  created_at: string
  creator: {
    id: string
    display_name: string
    username: string
    avatar_url: string | null
    bio: string | null
  } | null
}

export default async function FollowsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/follows')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: followsData } = await supabase
    .from('follows')
    .select('created_at, creator:profiles!follows_creator_id_fkey(id, display_name, username, avatar_url, bio)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })

  const follows = (followsData ?? []) as unknown as FollowRow[]
  const valid = follows.filter(f => f.creator)

  // 各クリエイターの最新コンテンツ
  const creatorIds = valid.map(f => f.creator!.id)
  const latestByCreator = new Map<string, { id: string; title: string; thumbnail_url: string | null }>()
  if (creatorIds.length > 0) {
    const { data: contents } = await supabase
      .from('contents')
      .select('id, creator_id, title, thumbnail_url, created_at')
      .in('creator_id', creatorIds)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    for (const c of contents ?? []) {
      if (!latestByCreator.has(c.creator_id)) {
        latestByCreator.set(c.creator_id, { id: c.id, title: c.title, thumbnail_url: c.thumbnail_url })
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 960, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← マイページへ</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 }}>
            <Heart size={22} color="#ec4899" fill="#ec4899" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>フォロー中のクリエイター</h1>
            <span style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginLeft: 4 }}>{valid.length}名</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>応援している推したち</p>
        </div>

        {valid.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>💗</p>
            <p style={{ fontSize: 15, marginBottom: 16 }}>まだ誰もフォローしていません</p>
            <Link href="/creators" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--mm-primary)', color: 'white', borderRadius: 999, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <UserPlus size={14} />クリエイターを探す
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {valid.map(f => {
              const c = f.creator!
              const latest = latestByCreator.get(c.id)
              return (
                <div key={c.id} className="mm-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Link href={`/creator/${c.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 22 }}>👤</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.display_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                    </div>
                  </Link>
                  {c.bio && (
                    <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.bio}
                    </p>
                  )}
                  {latest && (
                    <Link href={`/contents/${latest.id}`} style={{ display: 'flex', gap: 10, padding: 8, background: 'var(--mm-bg)', borderRadius: 8, textDecoration: 'none', alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                        {latest.thumbnail_url
                          ? <img src={latest.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 18 }}>📷</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', fontWeight: 600 }}>最新コンテンツ</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latest.title}</p>
                      </div>
                    </Link>
                  )}
                  <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 'auto' }}>
                    フォロー: {new Date(f.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
