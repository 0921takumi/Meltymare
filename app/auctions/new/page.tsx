import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import AuctionForm from './AuctionForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'リクエスト投稿' }
export const dynamic = 'force-dynamic'

export default async function NewAuctionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/auctions/new')
  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>リクエストを投稿</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 22 }}>
          欲しいコンテンツの内容と予算を投稿、複数のクリエイターから提案が届きます
        </p>
        <AuctionForm />
      </div>
    </div>
  )
}
