import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, Trophy } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'コレクション帳' }
export const dynamic = 'force-dynamic'

interface PurchaseRow {
  id: string
  created_at: string
  content: {
    id: string
    title: string
    thumbnail_url: string | null
    price: number
    creator_id: string
    creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  } | null
}

export default async function CollectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/collection')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: purchasesData } = await supabase
    .from('purchases')
    .select('id, created_at, content:contents(id, title, thumbnail_url, price, creator_id, creator:profiles(id, display_name, username, avatar_url))')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const purchases = (purchasesData ?? []) as unknown as PurchaseRow[]

  const byCreator = new Map<string, { creator: NonNullable<PurchaseRow['content']>['creator']; items: PurchaseRow[]; total: number }>()
  for (const p of purchases) {
    if (!p.content?.creator) continue
    const cid = p.content.creator.id
    const g = byCreator.get(cid) ?? { creator: p.content.creator, items: [], total: 0 }
    g.items.push(p)
    g.total += p.content.price
    byCreator.set(cid, g)
  }
  const creatorGroups = Array.from(byCreator.values()).sort((a, b) => b.total - a.total)

  const totalItems = purchases.length
  const uniqueCreators = creatorGroups.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← マイページへ</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 6 }}>
            <BookOpen size={22} color="#a855f7" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>コレクション帳</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>あなたが集めた推しアイテム</p>
        </div>

        {/* 統計カード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
          <div className="mm-card" style={{ padding: 18, textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--mm-primary)' }}>{totalItems}</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>コレクション数</p>
          </div>
          <div className="mm-card" style={{ padding: 18, textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#ec4899' }}>{uniqueCreators}</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>応援クリエイター</p>
          </div>
          <div className="mm-card" style={{ padding: 18, textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#a855f7' }}>
              {creatorGroups[0]?.items.length ?? 0}
            </p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>最多推し</p>
          </div>
        </div>

        {purchases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>📖</p>
            <p style={{ fontSize: 15, marginBottom: 8 }}>まだコレクションがありません</p>
            <Link href="/contents" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>推しを探しに行く →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {creatorGroups.map(group => {
              const c = group.creator!
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Link href={`/creator/${c.username}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden' }}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 700 }}>{c.display_name[0]}</div>}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)' }}>{c.display_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{group.items.length}件 · ¥{group.total.toLocaleString()}</p>
                      </div>
                    </Link>
                    {group.items.length >= 5 && (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12 }}>
                        <Trophy size={11} />ガチ推し
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                    {group.items.map(p => (
                      <Link key={p.id} href={`/contents/${p.content!.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: 'var(--mm-primary-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
                          {p.content?.thumbnail_url ? (
                            <img src={p.content.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>📷</div>
                          )}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                            <p style={{ fontSize: 11, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.content?.title}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
