import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StoryDeleteButton from './StoryDeleteButton'
import { Sparkles, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface StoryRow {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  view_count: number
  expires_at: string
  created_at: string
  creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
}

export default async function AdminStoriesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('stories')
    .select('id, media_url, media_type, caption, view_count, expires_at, created_at, creator:profiles!stories_creator_id_fkey(id, display_name, username, avatar_url)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(60)

  const stories = (data ?? []) as unknown as StoryRow[]

  return (
    <div className="admin-page">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>ストーリー管理</h1>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 4 }}>公開中のストーリー（24時間以内） · 不適切な投稿を削除</p>
      </div>

      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 14 }}>{stories.length}件公開中</p>

      {stories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
          <Sparkles size={36} />
          <p style={{ fontSize: 13, marginTop: 8 }}>公開中のストーリーはありません</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
          {stories.map(s => (
            <div key={s.id} className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ aspectRatio: '9/16', background: '#000', position: 'relative' }}>
                {s.media_type === 'image'
                  ? <img src={s.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <video src={s.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ padding: 10 }}>
                <Link href={`/creator/${s.creator?.username}`} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)' }}>
                    {s.creator?.avatar_url ? <img src={s.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.creator?.display_name}</p>
                </Link>
                <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={10} />{s.view_count}
                  · {Math.floor((new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))}h残
                </p>
                {s.caption && (
                  <p style={{ fontSize: 10, color: 'var(--mm-text-sub)', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.caption}</p>
                )}
                <StoryDeleteButton id={s.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
