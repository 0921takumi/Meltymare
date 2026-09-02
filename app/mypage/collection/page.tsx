import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
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
    hard_takedown?: boolean | null
    creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  } | null
}

export default async function CollectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/collection')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()

  // 検証で判明した実害: 購入後に運営がその商品を取り下げる（却下=is_published false）と、
  // RLS越しの埋め込み取得では contents が null になり、購入履歴から行ごと消えて
  // ダウンロード・領収書に到達できなくなる（＝支払い済みの購入者が商品を失う）。
  // 購入者に自分が買ったものを見せるのは取り下げ後も必要なので、購入行はセッション
  // (自分の行のみRLSで保証) で取り、商品情報だけ service_role で取り直して合成する。
  const { data: purchaseRows } = await supabase
    .from('purchases')
    .select('id, created_at, content_id')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const purchasedContentIds = [...new Set((purchaseRows ?? []).map((p: any) => p.content_id))]
  const contentById = new Map<string, any>()
  if (purchasedContentIds.length > 0) {
    // v57 追随: /mypage と同様に hard_takedown を見て、配信停止した商品はサムネイルもリンクも出さない
    // （納品前監査で「コレクション帳だけ配信停止した商品が通常どおり並び続ける」と指摘）。
    const admin = createAdminClient()
    const COLS = 'id, title, thumbnail_url, price, creator_id, creator:profiles!contents_creator_id_fkey(id, display_name, username, avatar_url)'
    let rows: any[] | null = null
    const withFlag = await admin.from('contents').select(`${COLS}, hard_takedown`).in('id', purchasedContentIds)
    if (withFlag.error?.code === '42703') {
      console.warn('[collection] hard_takedown 列が未適用:', withFlag.error.message)
      const plain = await admin.from('contents').select(COLS).in('id', purchasedContentIds)
      if (plain.error) console.error('[collection] contents lookup failed:', plain.error.message)
      rows = plain.data
    } else {
      if (withFlag.error) console.error('[collection] contents lookup failed:', withFlag.error.message)
      rows = withFlag.data
    }
    for (const r of rows ?? []) contentById.set(r.id, r)
  }
  const purchases = ((purchaseRows ?? []).map((p: any) => ({
    id: p.id, created_at: p.created_at, content: contentById.get(p.content_id) ?? null,
  })) as unknown) as PurchaseRow[]

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
                    {group.items.map(p => p.content?.hard_takedown ? (
                      <div key={p.id} style={{ aspectRatio: '1/1', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8, textAlign: 'center' }}>
                        <span style={{ fontSize: 20 }}>⛔</span>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', lineHeight: 1.4 }}>配信停止中</p>
                        <p style={{ fontSize: 9, color: '#991b1b', lineHeight: 1.3 }}>運営にお問い合わせください</p>
                      </div>
                    ) : (
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
