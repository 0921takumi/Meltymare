import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import AccountSettingsForm from './AccountSettingsForm'

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>アカウント設定</h1>
        <AccountSettingsForm email={user.email ?? ''} />
      </div>
    </div>
  )
}
