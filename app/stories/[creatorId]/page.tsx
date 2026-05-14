import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import StoryViewer from './StoryViewer'

export const dynamic = 'force-dynamic'

interface StoryRow {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  created_at: string
  view_count: number
}

export default async function CreatorStoryPage({ params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: creator } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', creatorId)
    .single()

  if (!creator) notFound()

  const { data: storiesData } = await supabase
    .from('stories')
    .select('id, media_url, media_type, caption, created_at, view_count')
    .eq('creator_id', creatorId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })

  const stories = (storiesData ?? []) as StoryRow[]

  if (stories.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'white', gap: 20 }}>
        <p>ストーリーは終了しました</p>
        <Link href="/stories" style={{ color: '#a855f7' }}>← 一覧へ</Link>
      </div>
    )
  }

  return <StoryViewer creator={creator} stories={stories} viewerId={user?.id ?? null} />
}
