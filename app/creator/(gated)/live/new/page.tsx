import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import StreamForm from './StreamForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '配信予約' }
export const dynamic = 'force-dynamic'

export default async function NewStreamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/live/new')
  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>配信を予約</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 22 }}>
          YouTube Live / Twitch / その他外部URL を登録、当プラットフォームでチャットを盛り上げよう
        </p>
        <StreamForm />
      </div>
    </div>
  )
}
