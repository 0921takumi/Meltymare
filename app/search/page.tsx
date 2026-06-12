import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
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
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
    profile = data
  }

  let creators: any[] = []
  let contents: any[] = []
  let purchasedIds: string[] = []

  if (query) {
    // ilike のワイルドカード（% _）はリテラルとして扱うため事前にエスケープする
    // （未エスケープだと「全件一致でDoS的に重いクエリを撃たれる」可能性がある）
    const safeQ = query.replace(/[\\%_]/g, (c) => '\\' + c).slice(0, 80)
    const [creatorsRes, contentsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio')
        .eq('role', 'creator')
        .ilike('display_name', `%${safeQ}%`)
        .limit(6),
      supabase
        .from('contents')
        .select('*, creator:profiles(id, display_name, avatar_url)')
        .eq('is_published', true)
        .ilike('title', `%${safeQ}%`)
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
          <div className="mm-card" style={{ textAlign: 'center', padding: 'clamp(40px,7vw,64px) 24px', position: 'relative', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', top: 16, left: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, left: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, right: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mm-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
              SEARCH
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
            </p>
            <p className="font-serif-display" style={{ fontStyle: 'italic', fontSize: 26, color: 'var(--mm-ink)', marginBottom: 12 }}>Find your favorite.</p>
            <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginBottom: 24 }}>クリエイター名やコンテンツ名を入力してください</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/contents?tag=チェキ" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--mm-bg)', border: '1px solid var(--mm-border)', color: 'var(--mm-text-sub)', padding: '8px 18px', borderRadius: 999, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>#チェキ</Link>
              <Link href="/contents?tag=動画" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--mm-bg)', border: '1px solid var(--mm-border)', color: 'var(--mm-text-sub)', padding: '8px 18px', borderRadius: 999, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>#動画</Link>
            </div>
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--mm-text)' }}>{creator.display_name}</p>
                          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>@{creator.username}</p>
                          {creator.bio && <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creator.bio}</p>}
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
      <Footer />
    </div>
  )
}
