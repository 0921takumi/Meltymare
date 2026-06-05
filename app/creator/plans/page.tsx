import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import PlansManager from './PlansManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'サブスクプラン管理' }
export const dynamic = 'force-dynamic'

interface PlanRow {
  id: string
  name: string
  description: string | null
  monthly_price: number
  benefits: string[]
  badge_emoji: string
  badge_color: string
  is_active: boolean
  member_count: number
  created_at: string
}

export default async function CreatorPlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/plans')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/')

  const { data: plansData } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('creator_id', user.id)
    .order('monthly_price', { ascending: true })

  const plans = (plansData ?? []) as PlanRow[]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>サブスクプラン管理</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 22 }}>
          月額メンバーシップを設定してファンと継続的な関係を築きましょう
        </p>
        <PlansManager initialPlans={plans} />
      </div>
    </div>
  )
}
