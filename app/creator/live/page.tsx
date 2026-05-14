import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StreamManager from './StreamManager'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ライブ配信管理' }
export const dynamic = 'force-dynamic'

interface Stream {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  scheduled_at: string
  ends_at: string | null
  stream_url: string | null
  is_premium: boolean
  premium_price: number | null
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  viewer_peak: number
}

export default async function CreatorLivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/live')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/')

  const { data: streamsData } = await supabase
    .from('live_streams')
    .select('*')
    .eq('creator_id', user.id)
    .order('scheduled_at', { ascending: false })

  const streams = (streamsData ?? []) as Stream[]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>ライブ配信管理</h1>
            <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 4 }}>YouTube Live / Twitch などの外部配信URLを連携</p>
          </div>
          <Link href="/creator/live/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#dc2626', color: 'white', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Plus size={14} />新規配信を予約
          </Link>
        </div>

        <StreamManager streams={streams} />
      </div>
    </div>
  )
}
