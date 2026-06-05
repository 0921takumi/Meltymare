import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import StoryUploader from './StoryUploader'
import StoryList from './StoryList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ストーリー管理' }
export const dynamic = 'force-dynamic'

interface StoryRow {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  view_count: number
  expires_at: string
  created_at: string
}

export default async function CreatorStoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/stories')
  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/')

  const { data: storiesData } = await supabase
    .from('stories')
    .select('id, media_url, media_type, caption, view_count, expires_at, created_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const stories = (storiesData ?? []) as StoryRow[]
  const active = stories.filter(s => new Date(s.expires_at) > new Date())
  const past = stories.filter(s => new Date(s.expires_at) <= new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>ストーリー管理</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 22 }}>
          24時間で消える短期投稿でフォロワーに日常を届けよう
        </p>

        <StoryUploader />

        {active.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>公開中 ({active.length})</h2>
            <StoryList stories={active} />
          </section>
        )}

        {past.length > 0 && (
          <section style={{ marginTop: 32, opacity: 0.5 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>期限切れ ({past.length})</h2>
            <StoryList stories={past} expired />
          </section>
        )}
      </div>
    </div>
  )
}
