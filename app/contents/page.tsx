import { createClient } from '@/lib/supabase/server'
import ContentCard from '@/components/ui/ContentCard'
import Header from '@/components/layout/Header'
import type { Content } from '@/types'

export default async function ContentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  const { data: contents } = await supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, avatar_url)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // 購入済みIDリスト取得
  let purchasedIds: string[] = []
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('content_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
    purchasedIds = purchases?.map(p => p.content_id) ?? []
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>コンテンツ一覧</h1>
            <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>{contents?.length ?? 0} 件</p>
          </div>
        </div>

        {!contents || contents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📭</p>
            <p style={{ fontSize: 16 }}>まだコンテンツがありません</p>
          </div>
        ) : (
          <div className="mm-content-grid">
            {contents.map((content: Content) => (
              <ContentCard
                key={content.id}
                content={content}
                isPurchased={purchasedIds.includes(content.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
