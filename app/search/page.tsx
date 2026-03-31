import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import ContentCard from '@/components/ui/ContentCard'
import Link from 'next/link'
import { Search } from 'lucide-react'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  let creators: any[] = []
  let contents: any[] = []
  let purchasedIds: string[] = []

  if (query) {
    const [creatorsRes, contentsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio')
        .eq('role', 'creator')
        .ilike('display_name', `%${query}%`)
        .limit(6),
      supabase
        .from('contents')
        .select('*, creator:profiles(id, display_name, avatar_url)')
        .eq('is_published', true)
        .ilike('title', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(12),
    ])
    creators = creatorsRes.data ?? []
    contents = contentsRes.data ?? []

    if (user) {
      const { data: purchases } = await supabase
        .from('purchases').select('content_id')
        .eq('user_id', user.id).eq('status', 'completed')
      purchasedIds = purchases?.map(p => p.content_id) ?? []
    }
  }

  const total = creators.length + contents.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* 検索ヘッダー */}
        <div style={{ marginBottom: 32 }}>
          <form method="GET" action="/search" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, position: 'relative', maxWidth: 520 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
              <input
                name="q"
                defaultValue={query}
                placeholder="クリエイター名・コンテンツ名で検索..."
                style={{ width: '100%', padding: '12px 14px 12px 36px', border: '1px solid var(--mm-border)', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" style={{ padding: '12px 24px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              検索
            </button>
          </form>
          {query && (
            <p style={{ fontSize: 14, color: 'var(--mm-text-muted)' }}>
              「<strong style={{ color: 'var(--mm-text)' }}>{query}</strong>」の検索結果 — {total}件
            </p>
          )}
        </div>

        {!query ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <Search size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 16 }}>クリエイター名やコンテンツ名を入力してください</p>
          </div>
        ) : total === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🔍</p>
            <p style={{ fontSize: 16, marginBottom: 8 }}>「{query}」に一致する結果が見つかりませんでした</p>
            <Link href="/contents" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>コンテンツ一覧を見る →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            {/* クリエイター */}
            {creators.length > 0 && (
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>クリエイター ({creators.length}件)</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {creators.map(creator => (
                    <Link key={creator.id} href={`/creator/${creator.username}`} style={{ textDecoration: 'none' }}>
                      <div className="mm-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--mm-primary-light)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                          {creator.avatar_url
                            ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : creator.display_name[0]}
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--mm-text)' }}>{creator.display_name}</p>
                          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>@{creator.username}</p>
                          {creator.bio && <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{creator.bio}</p>}
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--mm-primary)', fontWeight: 600, flexShrink: 0 }}>プロフィールを見る →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* コンテンツ */}
            {contents.length > 0 && (
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>コンテンツ ({contents.length}件)</h2>
                <div className="mm-content-grid">
                  {contents.map((content: any) => (
                    <ContentCard key={content.id} content={content} isPurchased={purchasedIds.includes(content.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
