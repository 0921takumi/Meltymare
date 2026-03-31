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

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* プロフィールヘッダー */}
        <div className="mm-card" style={{ padding: '20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.display_name}</p>
              <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--mm-primary)' }}>{contents.length}</p>
              <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>購入済み</p>
              <a href="/mypage/profile" style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600 }}>
                プロフィール編集
              </a>
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>購入済みコンテンツ</h2>

        {contents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🛍️</p>
            <p style={{ fontSize: 16, marginBottom: 8 }}>まだ購入したコンテンツがありません</p>
            <a href="/contents" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>
              コンテンツを探す →
            </a>
          </div>
        ) : (
          <div className="mm-content-grid">
            {contents.map((content: any) => (
              <ContentCard key={content.id} content={content} isPurchased={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
