import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Medal } from 'lucide-react'

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309']
const CARD_COLORS = [
  { bg: '#e8b4c8', text: '#8b2252' }, { bg: '#b4d4e8', text: '#1a5276' },
  { bg: '#c8e8b4', text: '#1e5631' }, { bg: '#e8d4b4', text: '#7d4e12' },
  { bg: '#d4b4e8', text: '#512e5f' }, { bg: '#e8e4b4', text: '#7d6608' },
  { bg: '#f4c6d8', text: '#8b2252' }, { bg: '#c0d8f4', text: '#1a5276' },
]

export default async function CreatorsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  // クリエイター一覧
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, bio')
    .eq('role', 'creator')
    .order('created_at', { ascending: true })

  // 各クリエイターのコンテンツ数と売上
  const creatorStats: Record<string, { count: number; sold: number }> = {}
  if (creators) {
    await Promise.all(creators.map(async c => {
      const { data: contents } = await supabase
        .from('contents')
        .select('sold_count')
        .eq('creator_id', c.id)
        .eq('is_published', true)
      const count = contents?.length ?? 0
      const sold = contents?.reduce((s, x) => s + (x.sold_count ?? 0), 0) ?? 0
      creatorStats[c.id] = { count, sold }
    }))
  }

  // 販売数でソート
  const ranked = [...(creators ?? [])].sort(
    (a, b) => (creatorStats[b.id]?.sold ?? 0) - (creatorStats[a.id]?.sold ?? 0)
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em', marginBottom: 6 }}>CREATOR</p>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>クリエイター一覧</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 4 }}>{ranked.length}名のクリエイターが在籍中</p>
        </div>

        {/* ランキングTOP3 */}
        {ranked.length >= 3 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Medal size={18} color="#f59e0b" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>販売数ランキング</h2>
            </div>
            <div className="mm-howto-grid">
              {ranked.slice(0, 3).map((creator, i) => {
                const stats = creatorStats[creator.id] ?? { count: 0, sold: 0 }
                const color = CARD_COLORS[i % CARD_COLORS.length]
                return (
                  <Link key={creator.id} href={`/creator/${creator.username}`} style={{ textDecoration: 'none' }}>
                    <div className="mm-card" style={{ padding: '24px 20px', textAlign: 'center', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 12, left: 16, fontSize: 20, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: RANK_COLORS[i] }}>
                        #{i + 1}
                      </div>
                      <div style={{ width: 72, height: 72, borderRadius: '50%', background: color.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: color.text, margin: '0 auto 12px', border: `3px solid ${RANK_COLORS[i]}`, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                        {creator.avatar_url
                          ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : creator.display_name[0]}
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{creator.display_name}</p>
                      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>@{creator.username}</p>
                      {creator.bio && <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginBottom: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{creator.bio}</p>}
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--mm-primary)' }}>{stats.count}</p>
                          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>コンテンツ</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{stats.sold}</p>
                          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>販売数</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* 全クリエイター */}
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>全クリエイター</h2>
        {ranked.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mm-text-muted)' }}>
            <p>まだクリエイターが登録されていません</p>
          </div>
        ) : (
          <div className="mm-cast-grid">
            {ranked.map((creator, i) => {
              const stats = creatorStats[creator.id] ?? { count: 0, sold: 0 }
              const color = CARD_COLORS[i % CARD_COLORS.length]
              return (
                <Link key={creator.id} href={`/creator/${creator.username}`} style={{ textDecoration: 'none' }}>
                  <div className="mm-card" style={{ padding: '20px 12px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: color.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: color.text, margin: '0 auto', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                        {creator.avatar_url
                          ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : creator.display_name[0]}
                      </div>
                      {i < 3 && (
                        <span style={{ position: 'absolute', top: -4, right: -6, background: RANK_COLORS[i], color: 'white', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>#{i + 1}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creator.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 8 }}>@{creator.username}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-primary)', fontWeight: 600 }}>📦 {stats.count}件</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* クリエイター登録案内 */}
        <div style={{ marginTop: 56, background: 'white', border: '1px solid var(--mm-border)', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>クリエイターとして出品しませんか？</p>
          <p style={{ fontSize: 14, color: 'var(--mm-text-muted)', marginBottom: 24, lineHeight: 1.7 }}>
            メッセージを書き込んだ写真・動画を販売できます。<br />登録無料、手数料は売れてから。
          </p>
          <Link href="/auth/signup" style={{ display: 'inline-block', background: 'var(--mm-primary)', color: 'white', padding: '13px 36px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            クリエイター登録はこちら
          </Link>
        </div>
      </div>
    </div>
  )
}
