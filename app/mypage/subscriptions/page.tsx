import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SubsList from './SubsList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'サブスクリプション' }
export const dynamic = 'force-dynamic'

interface SubRow {
  id: string
  status: 'active' | 'cancelled' | 'expired'
  started_at: string
  current_period_end: string
  cancelled_at: string | null
  plan: {
    id: string
    name: string
    description: string | null
    monthly_price: number
    benefits: string[]
    badge_emoji: string
    badge_color: string
  } | null
  creator: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export default async function SubscriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/subscriptions')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: subsData } = await supabase
    .from('subscriptions')
    .select('id, status, started_at, current_period_end, cancelled_at, plan:subscription_plans(id, name, description, monthly_price, benefits, badge_emoji, badge_color), creator:profiles!subscriptions_creator_id_fkey(id, username, display_name, avatar_url)')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  const subs = (subsData ?? []) as unknown as SubRow[]
  const active = subs.filter(s => s.status === 'active')
  const past = subs.filter(s => s.status !== 'active')

  const monthlyTotal = active.reduce((s, x) => s + (x.plan?.monthly_price ?? 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/mypage" style={{ fontSize: 12, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← マイページへ</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>サブスクリプション</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 22 }}>応援中のクリエイター月額メンバーシップ</p>

        <div className="mm-card" style={{ padding: '18px 22px', marginBottom: 24, background: 'linear-gradient(135deg, #f3e8ff 0%, white 70%)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.05em' }}>MONTHLY TOTAL</p>
          <p style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>¥{monthlyTotal.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--mm-text-muted)' }}>/月</span></p>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>{active.length}つのプランに加入中</p>
        </div>

        <SubsList subs={subs} />

        {subs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>💎</p>
            <p style={{ fontSize: 14, marginBottom: 8 }}>まだ加入中のプランがありません</p>
            <Link href="/creators" style={{ fontSize: 13, color: 'var(--mm-primary)', fontWeight: 700, textDecoration: 'none' }}>クリエイターを探す →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
