import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import ContentCard from '@/components/ui/ContentCard'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ContentsFilter from './ContentsFilter'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

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
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
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
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--mm-text-sub)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
            ALL CONTENTS
          </p>
          <h1 className="font-serif-display" style={{ fontSize: 'clamp(24px, 5vw, 30px)', fontWeight: 500, color: 'var(--mm-ink)', marginBottom: 6, letterSpacing: '0.04em' }}>コンテンツ一覧</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>
            <span className="font-serif-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--mm-ink)' }}>{contents?.length ?? 0}</span>
            <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginLeft: 5 }}>items</span>
          </p>
        </div>

        {/* あなたへのおすすめ */}
        {recommendations && recommendations.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={17} color="var(--mm-primary)" />
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
          <div style={{ position: 'relative', background: 'white', border: '1px solid var(--mm-border)', borderRadius: 16, padding: 'clamp(48px, 8vw, 72px) 24px', textAlign: 'center', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', top: 16, left: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, left: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, right: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <p className="font-serif-display" style={{ fontSize: 28, fontWeight: 500, fontStyle: 'italic', color: 'var(--mm-ink)', marginBottom: 12 }}>Nothing here yet.</p>
            <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', marginBottom: 20 }}>条件に合うコンテンツが見つかりませんでした。条件を変えて探してみてください。</p>
            <Link href="/contents" style={{ fontSize: 13, color: 'var(--mm-text)', fontWeight: 600, borderBottom: '1px solid var(--mm-ink)', paddingBottom: 2, textDecoration: 'none' }}>
              フィルターをリセット <span style={{ color: 'var(--mm-primary)' }}>→</span>
            </Link>
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

      <Footer />
    </div>
  )
}
