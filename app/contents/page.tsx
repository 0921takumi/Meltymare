import { createClient } from '@/lib/supabase/server'
import ContentCard from '@/components/ui/ContentCard'
import Header from '@/components/layout/Header'
import ContentsFilter from './ContentsFilter'
import { Sparkles } from 'lucide-react'

type SortKey = 'newest' | 'popular' | 'price_asc' | 'price_desc'
type TypeKey = 'all' | 'image' | 'video'

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; type?: string; tag?: string }>
}) {
  const { sort = 'newest', type = 'all', tag } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  let query = supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, avatar_url)')
    .eq('is_published', true)

  if (type !== 'all') query = query.eq('content_type', type)
  if (tag) query = query.contains('tags', [tag])

  switch (sort as SortKey) {
    case 'popular':
      query = query.order('sold_count', { ascending: false })
      break
    case 'price_asc':
      query = query.order('price', { ascending: true })
      break
    case 'price_desc':
      query = query.order('price', { ascending: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  const { data: contents } = await query

  // 人気タグ集計
  const allTags: Record<string, number> = {}
  contents?.forEach((c: any) => {
    if (Array.isArray(c.tags)) {
      c.tags.forEach((t: string) => { allTags[t] = (allTags[t] ?? 0) + 1 })
    }
  })
  const popularTags = Object.entries(allTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t)

  // 購入済みIDリスト
  let purchasedIds: string[] = []
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('content_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
    purchasedIds = purchases?.map(p => p.content_id) ?? []
  }

  // あなたへのおすすめ（協調フィルタ風）
  // ロジック: 自分が購入したクリエイターと「同じクリエイターを買った他人」が買っている別コンテンツをレコメンド
  let recommendations: typeof contents = []
  if (user && purchasedIds.length > 0) {
    const { data: myPurchasesWithCreator } = await supabase
      .from('purchases')
      .select('content:contents!inner(creator_id)')
      .eq('user_id', user.id).eq('status', 'completed')
    const myCreatorIds = Array.from(new Set(
      (myPurchasesWithCreator ?? [])
        .map((p: any) => p.content?.creator_id)
        .filter(Boolean)
    ))
    if (myCreatorIds.length > 0) {
      const { data: peerPurchases } = await supabase
        .from('purchases')
        .select('user_id, content:contents!inner(creator_id)')
        .in('content.creator_id', myCreatorIds)
        .eq('status', 'completed')
        .neq('user_id', user.id)
      const peerUserIds = Array.from(new Set((peerPurchases ?? []).map((p: any) => p.user_id)))
      if (peerUserIds.length > 0) {
        const { data: peerContents } = await supabase
          .from('purchases')
          .select('content_id')
          .in('user_id', peerUserIds)
          .eq('status', 'completed')
        const peerContentIds = (peerContents ?? []).map(p => p.content_id)
        const scoreMap = new Map<string, number>()
        for (const cid of peerContentIds) {
          if (purchasedIds.includes(cid)) continue
          scoreMap.set(cid, (scoreMap.get(cid) ?? 0) + 1)
        }
        const topIds = Array.from(scoreMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id)
        if (topIds.length > 0) {
          const { data: recs } = await supabase
            .from('contents')
            .select('*, creator:profiles(id, display_name, avatar_url)')
            .in('id', topIds)
            .eq('is_published', true)
          recommendations = recs ?? []
        }
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>コンテンツ一覧</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>{contents?.length ?? 0} 件</p>
        </div>

        {/* あなたへのおすすめ */}
        {recommendations && recommendations.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={17} color="#a855f7" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>あなたへのおすすめ</h2>
              <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 500 }}>同じ推しを応援する人がチェックしているコンテンツ</span>
            </div>
            <div className="mm-content-grid">
              {recommendations.map((c: any) => (
                <ContentCard key={c.id} content={c} isPurchased={false} />
              ))}
            </div>
          </div>
        )}

        {/* フィルター・ソート (Client Component) */}
        <ContentsFilter
          currentSort={sort}
          currentType={type}
          currentTag={tag ?? ''}
          popularTags={popularTags}
        />

        {!contents || contents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📭</p>
            <p style={{ fontSize: 16 }}>コンテンツが見つかりませんでした</p>
          </div>
        ) : (
          <div className="mm-content-grid">
            {contents.map((content: any) => (
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
