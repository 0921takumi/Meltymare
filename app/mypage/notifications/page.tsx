import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, ShoppingBag, PackageCheck, MessageSquare, Star, UserPlus, Heart } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '通知' }
export const dynamic = 'force-dynamic'

type NotificationKind = 'purchase' | 'delivery' | 'request_reply' | 'review' | 'follow' | 'new_content'

interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body: string
  href: string
  createdAt: string
  thumbnailUrl?: string | null
  avatarUrl?: string | null
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}時間前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}日前`
  return new Date(iso).toLocaleDateString('ja-JP')
}

type CreatorRef = { id?: string; display_name: string | null; avatar_url: string | null; username?: string } | null
type ContentRef = { id: string; title: string; thumbnail_url: string | null; creator_id?: string; creator?: CreatorRef } | null
type PurchaseRow = {
  id: string; status: string; delivery_status: string | null; delivered_at: string | null; created_at: string
  content: ContentRef
}
type SaleRow = {
  id: string; amount: number | null; created_at: string
  content: ContentRef
  buyer: CreatorRef
}
type RequestRow = {
  id: string; status: string; creator_reply: string | null; updated_at: string
  creator: CreatorRef
}
type NewContentRow = {
  id: string; title: string; thumbnail_url: string | null; created_at: string
  creator: CreatorRef
}
type FollowerRow = {
  created_at: string
  follower: CreatorRef
}
type ReviewRow = {
  id: string; rating: number; comment: string | null; created_at: string
  content: ContentRef
  reviewer: CreatorRef
}

const KIND_CONFIG: Record<NotificationKind, { icon: typeof Bell; color: string; bg: string }> = {
  purchase:      { icon: ShoppingBag,   color: '#0e7490', bg: '#cffafe' },
  delivery:      { icon: PackageCheck,  color: '#059669', bg: '#d1fae5' },
  request_reply: { icon: MessageSquare, color: '#7c3aed', bg: '#ede9fe' },
  review:        { icon: Star,          color: '#f59e0b', bg: '#fef3c7' },
  follow:        { icon: UserPlus,      color: '#ec4899', bg: '#fce7f3' },
  new_content:   { icon: Heart,         color: '#a855f7', bg: '#f3e8ff' },
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/notifications')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
  const isCreator = profile?.role === 'creator' || profile?.role === 'admin'

  const items: NotificationItem[] = []

  // 自分の購入完了 / 納品完了
  const { data: myPurchases } = await supabase
    .from('purchases')
    .select('id, status, delivery_status, delivered_at, created_at, content:contents(id, title, thumbnail_url, creator:profiles(display_name, avatar_url))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  for (const p of (myPurchases ?? []) as unknown as PurchaseRow[]) {
    if (p.status === 'completed') {
      items.push({
        id: `purchase-${p.id}`,
        kind: 'purchase',
        title: '購入が完了しました',
        body: `${p.content?.creator?.display_name ?? ''}「${p.content?.title ?? ''}」`,
        href: `/contents/${p.content?.id}`,
        createdAt: p.created_at,
        thumbnailUrl: p.content?.thumbnail_url,
      })
    }
    if (p.delivery_status === 'delivered' && p.delivered_at) {
      items.push({
        id: `delivery-${p.id}`,
        kind: 'delivery',
        title: '納品されました',
        body: `${p.content?.title ?? ''} がダウンロード可能になりました`,
        href: `/api/download/${p.id}`,
        createdAt: p.delivered_at,
        thumbnailUrl: p.content?.thumbnail_url,
      })
    }
  }

  // 自分のリクエストへの返信
  const { data: myRequests } = await supabase
    .from('requests')
    .select('id, status, creator_reply, updated_at, creator:profiles!requests_creator_id_fkey(display_name, avatar_url, username)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  for (const r of (myRequests ?? []) as unknown as RequestRow[]) {
    if (r.status === 'accepted' || r.status === 'rejected' || r.creator_reply) {
      items.push({
        id: `request-${r.id}`,
        kind: 'request_reply',
        title: r.status === 'accepted' ? 'リクエストが承認されました' : r.status === 'rejected' ? 'リクエストが見送られました' : 'リクエストに返信が届きました',
        body: `${r.creator?.display_name ?? ''}: ${(r.creator_reply ?? '').slice(0, 60)}`,
        href: `/requests`,
        createdAt: r.updated_at,
        avatarUrl: r.creator?.avatar_url,
      })
    }
  }

  // フォロー中クリエイターの新規コンテンツ (直近30日)
  const { data: myFollows } = await supabase
    .from('follows')
    .select('creator_id')
    .eq('follower_id', user.id)

  const followedIds = (myFollows ?? []).map(f => f.creator_id)
  if (followedIds.length > 0) {
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const { data: newContents } = await supabase
      .from('contents')
      .select('id, title, thumbnail_url, created_at, creator:profiles(id, display_name, avatar_url)')
      .in('creator_id', followedIds)
      .eq('is_published', true)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    for (const c of (newContents ?? []) as unknown as NewContentRow[]) {
      items.push({
        id: `newcontent-${c.id}`,
        kind: 'new_content',
        title: '推しが新しい投稿をしました',
        body: `${c.creator?.display_name ?? ''}「${c.title}」`,
        href: `/contents/${c.id}`,
        createdAt: c.created_at,
        thumbnailUrl: c.thumbnail_url,
        avatarUrl: c.creator?.avatar_url,
      })
    }
  }

  // クリエイター向け: 自分への新規フォロワー / 売上 / レビュー
  if (isCreator) {
    const { data: newFollowers } = await supabase
      .from('follows')
      .select('created_at, follower:profiles!follows_follower_id_fkey(id, display_name, avatar_url, username)')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const f of (newFollowers ?? []) as unknown as FollowerRow[]) {
      items.push({
        id: `follower-${f.follower?.id}-${f.created_at}`,
        kind: 'follow',
        title: '新しいフォロワー',
        body: `${f.follower?.display_name ?? ''} さんがあなたをフォローしました`,
        href: `/creator/dashboard`,
        createdAt: f.created_at,
        avatarUrl: f.follower?.avatar_url,
      })
    }

    const { data: salesData } = await supabase
      .from('purchases')
      .select('id, amount, created_at, content:contents!inner(id, creator_id, title, thumbnail_url), buyer:profiles!purchases_user_id_fkey(display_name, avatar_url)')
      .eq('content.creator_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20)

    for (const p of (salesData ?? []) as unknown as SaleRow[]) {
      items.push({
        id: `sale-${p.id}`,
        kind: 'purchase',
        title: 'コンテンツが売れました',
        body: `${p.buyer?.display_name ?? ''}さんが「${p.content?.title ?? ''}」を購入 (¥${(p.amount ?? 0).toLocaleString()})`,
        href: `/creator/dashboard`,
        createdAt: p.created_at,
        thumbnailUrl: p.content?.thumbnail_url,
        avatarUrl: p.buyer?.avatar_url,
      })
    }

    const { data: myReviews } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, content:contents!inner(id, creator_id, title), reviewer:profiles!reviews_user_id_fkey(display_name, avatar_url)')
      .eq('content.creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const r of (myReviews ?? []) as unknown as ReviewRow[]) {
      items.push({
        id: `review-${r.id}`,
        kind: 'review',
        title: '新しいレビュー',
        body: `${'★'.repeat(r.rating)} ${r.reviewer?.display_name ?? ''}: ${(r.comment ?? '').slice(0, 60)}`,
        href: `/contents/${r.content?.id}`,
        createdAt: r.created_at,
        avatarUrl: r.reviewer?.avatar_url,
      })
    }
  }

  // 並び替え（新しい順）
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← マイページへ</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 }}>
            <Bell size={22} color="var(--mm-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>通知</h1>
            <span style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginLeft: 4 }}>{items.length}件</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🔕</p>
            <p style={{ fontSize: 15 }}>通知はまだありません</p>
          </div>
        ) : (
          <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((it, i) => {
              const cfg = KIND_CONFIG[it.kind]
              const Icon = cfg.icon
              return (
                <Link key={it.id} href={it.href} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                  borderBottom: i < items.length - 1 ? '1px solid var(--mm-border)' : 'none',
                  textDecoration: 'none',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text)' }}>{it.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.body}</p>
                    <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>{timeAgo(it.createdAt)}</p>
                  </div>
                  {it.thumbnailUrl ? (
                    <img src={it.thumbnailUrl} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  ) : it.avatarUrl ? (
                    <img src={it.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
