import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import ContentCard from '@/components/ui/ContentCard'
import { redirect } from 'next/navigation'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, content:contents(*, creator:profiles(id, display_name, avatar_url))')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const contents = purchases?.map(p => p.content).filter(Boolean) ?? []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* プロフィールヘッダー */}
        <div className="mm-card" style={{ padding: '24px 28px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : '👤'}
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{profile?.display_name}</p>
            <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 2 }}>{user.email}</p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--mm-primary)' }}>{contents.length}</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>購入済み</p>
            <a href="/mypage/profile" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600 }}>
              プロフィール編集
            </a>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>購入済みコンテンツ</h2>

        {contents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🛍️</p>
            <p style={{ fontSize: 16, marginBottom: 8 }}>まだ購入したコンテンツがありません</p>
            <a href="/contents" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>
              コンテンツを探す →
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {contents.map((content: any) => (
              <ContentCard key={content.id} content={content} isPurchased={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
