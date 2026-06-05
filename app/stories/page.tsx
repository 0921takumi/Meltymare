import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ストーリー' }
export const dynamic = 'force-dynamic'

interface StoryRow {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  view_count: number
  expires_at: string
  created_at: string
  creator: { id: string; username: string; display_name: string; avatar_url: string | null } | null
}

export default async function StoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single() : { data: null }

  const { data: storiesData } = await supabase
    .from('stories')
    .select('id, media_url, media_type, caption, view_count, expires_at, created_at, creator:profiles!stories_creator_id_fkey(id, username, display_name, avatar_url)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const stories = (storiesData ?? []) as unknown as StoryRow[]

  // クリエイターでグルーピング
  const byCreator = new Map<string, { creator: NonNullable<StoryRow['creator']>; stories: StoryRow[] }>()
  for (const s of stories) {
    if (!s.creator) continue
    const g = byCreator.get(s.creator.id) ?? { creator: s.creator, stories: [] }
    g.stories.push(s)
    byCreator.set(s.creator.id, g)
  }
  const groups = Array.from(byCreator.values())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Sparkles size={22} color="#a855f7" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>ストーリー</h1>
          <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>24時間で消える投稿</span>
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📸</p>
            <p style={{ fontSize: 14 }}>現在公開中のストーリーはありません</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {groups.map(g => {
              const top = g.stories[0]
              return (
                <Link key={g.creator.id} href={`/stories/${g.creator.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ position: 'relative', aspectRatio: '9/16', borderRadius: 14, overflow: 'hidden', background: '#000', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
                    {top.media_type === 'image' ? (
                      <img src={top.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <video src={top.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {/* Gradient overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)' }} />
                    {/* Top bar (story count) */}
                    <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', gap: 3 }}>
                      {g.stories.slice(0, 5).map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
                      ))}
                    </div>
                    {/* Avatar */}
                    <div style={{ position: 'absolute', top: 16, left: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid white' }}>
                        {g.creator.avatar_url ? <img src={g.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ background: 'var(--mm-primary)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>{g.creator.display_name[0]}</div>}
                      </div>
                      <p style={{ fontSize: 11, color: 'white', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{g.creator.display_name}</p>
                    </div>
                    {/* Story count badge */}
                    {g.stories.length > 1 && (
                      <span style={{ position: 'absolute', top: 16, right: 12, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        {g.stories.length}件
                      </span>
                    )}
                    {/* Caption */}
                    {top.caption && (
                      <p style={{ position: 'absolute', bottom: 12, left: 12, right: 12, fontSize: 11, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.6)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{top.caption}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
