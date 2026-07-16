import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import { CONTENT_CARD_WITH_CREATOR_SELECT } from '@/lib/content-fields'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import PurchaseButton from './PurchaseButton'
import ContentCard from '@/components/ui/ContentCard'
import ReviewSection from './ReviewSection'
import Comments, { type CommentItem } from '@/components/Comments'
import { notFound } from 'next/navigation'
import { ImageIcon, VideoIcon, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: content } = await supabase
    .from('contents')
    .select('title, description, thumbnail_url, price, creator:profiles(display_name)')
    .eq('id', id)
    .single()
  if (!content) return { title: 'コンテンツが見つかりません', robots: { index: false, follow: false } }
  const creator = content.creator as any
  const desc = content.description ?? `${creator?.display_name ?? ''} の限定コンテンツ ¥${content.price.toLocaleString()}`
  return {
    title: content.title,
    description: desc,
    openGraph: {
      title: `${content.title} | My Focus`,
      description: desc,
      images: content.thumbnail_url ? [{ url: content.thumbnail_url }] : [],
    },
    twitter: { card: 'summary_large_image', title: content.title, description: desc },
  }
}

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
    profile = data
  }

  const CONTENT_SELECT = '*, creator:profiles(id, display_name, username, avatar_url, bio, twitter_url, instagram_url, tiktok_url)'
  let { data: content } = await supabase
    .from('contents')
    .select(CONTENT_SELECT)
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()

  if (!content) {
    // 監査で発覚: is_published=true固定のため、管理者が審査前(pending/rejected)の
    // コンテンツをプレビューしようとすると常に404になり、中身を見ずに承認/却下ボタンを
    // 押すしかない状態だった。RLS(v27/v31)は既に「本人(creator)は自分の全status閲覧可、
    // adminは全件閲覧可」を保証しているため、is_publishedで縛らずに再試行するだけでよい
    // （無関係な訪問者は同じクエリでもRLSにより0件になるため安全）。
    const { data: fallback } = await supabase.from('contents').select(CONTENT_SELECT).eq('id', id).maybeSingle()
    content = fallback
  }

  if (!content) return notFound()

  // v49: 凍結・退会済みクリエイターのコンテンツが一般訪問者から見えたまま購入可能だった
  // （proxy.ts の凍結ゲートは本人のダッシュボードアクセスを止めるだけ）。ただし
  // 本人(自分のコンテンツ確認)とadmin(モデレーション目的の確認)は従来通り閲覧可能に
  // する必要があるため、それ以外の第三者にだけ404を返す。is_suspended/deleted_at は
  // 他人の行のPII列のため service_role(admin) で読む。
  const isOwner = !!user && user.id === (content as { creator_id: string }).creator_id
  const isAdminViewer = profile?.role === 'admin'
  if (!isOwner && !isAdminViewer) {
    const admin = createAdminClient()
    const { data: creatorStatus } = await admin
      .from('profiles')
      .select('is_suspended, deleted_at')
      .eq('id', (content as { creator_id: string }).creator_id)
      .maybeSingle()
    if (creatorStatus?.is_suspended || creatorStatus?.deleted_at) return notFound()
  }

  // 購入済みチェック
  let isPurchased = false
  let deliveryStatus: 'pending' | 'delivered' | null = null
  let downloadUrl = null
  if (user) {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_id', id)
      .eq('status', 'completed')
      .single()
    isPurchased = !!purchase
    deliveryStatus = (purchase as any)?.delivery_status ?? 'pending'

    if (isPurchased && deliveryStatus === 'delivered' && (purchase as any)?.delivered_file_url) {
      const { data: urlData, error: signedUrlErr } = await supabase.storage
        .from('deliveries')
        .createSignedUrl((purchase as any).delivered_file_url, 3600)
      if (signedUrlErr) console.error('[contents/[id]] createSignedUrl failed:', signedUrlErr.message)
      downloadUrl = urlData?.signedUrl ?? null
    }
  }

  const isSoldOut = content.stock_limit != null && content.sold_count >= content.stock_limit

  // 同クリエイターの他コンテンツ（最大4件）
  // v49: select('*') だと file_url（購入者しかDLしてはいけない実ファイルの保管パス）まで
  // 取得され、ContentCard('use client')に丸ごと渡すことでRSCペイロードに乗って
  // 未購入の訪問者のブラウザにまで送られていた（ContentCard自体はfile_urlを一切
  // 使っていない＝完全に不要な露出）。ContentCardが実際に使う列だけを明示selectする。
  const { data: relatedContents } = await supabase
    .from('contents')
    .select(CONTENT_CARD_WITH_CREATOR_SELECT)
    .eq('creator_id', content.creator_id)
    .eq('is_published', true)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(4)

  // 購入済みIDリスト（関連コンテンツ用）
  let purchasedIds: string[] = []
  if (user) {
    const { data: allPurchases } = await supabase
      .from('purchases').select('content_id')
      .eq('user_id', user.id).eq('status', 'completed')
    purchasedIds = allPurchases?.map(p => p.content_id) ?? []
  }

  // レビュー取得
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, user:profiles(display_name)')
    .eq('content_id', id)
    .order('created_at', { ascending: false })

  // コメント取得 + いいね集計
  // 監査で発覚: is_hidden=false固定フィルタのため、通報により非表示化された自分の
  // コメントが投稿者本人からも完全に消え、非表示になった事実に気づく手段が無かった。
  // RLS(comments_select)は元々「is_hidden=false OR 本人」を許可する設計なので、
  // アプリ側もそれに合わせて自分の分だけは非表示でも取得する。
  let commentsQuery = supabase
    .from('content_comments')
    .select('id, body, created_at, user_id, is_hidden, user:profiles!content_comments_user_id_fkey(id, display_name, avatar_url, username)')
    .eq('content_id', id)
  commentsQuery = user
    ? commentsQuery.or(`is_hidden.eq.false,user_id.eq.${user.id}`)
    : commentsQuery.eq('is_hidden', false)
  const { data: commentsData } = await commentsQuery
    .order('created_at', { ascending: false })
    .limit(50)

  const commentIds = (commentsData ?? []).map(c => c.id)
  const likesByComment = new Map<string, number>()
  const likedByMe = new Set<string>()
  if (commentIds.length > 0) {
    const { data: likes } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    for (const l of likes ?? []) {
      likesByComment.set(l.comment_id, (likesByComment.get(l.comment_id) ?? 0) + 1)
      if (user?.id && l.user_id === user.id) likedByMe.add(l.comment_id)
    }
  }
  const comments: CommentItem[] = (commentsData ?? []).map(c => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    user: (c.user as unknown as CommentItem['user']) ?? null,
    likes: likesByComment.get(c.id) ?? 0,
    liked_by_me: likedByMe.has(c.id),
    is_hidden: (c as unknown as { is_hidden?: boolean }).is_hidden ?? false,
  }))

  let myReview: any = null
  if (user) {
    myReview = reviews?.find(r => r.user_id === user.id) ?? null
  }

  // おすすめクリエイター（このクリエイター以外、最大4名）
  const { data: recCreators } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('role', 'creator')
    .neq('id', content.creator_id)
    .limit(4)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="mm-content-detail" style={{ alignItems: 'start' }}>

          {/* サムネイル（PC 4/3・モバイル 4/5 = チェキ縦。.mm-content-detail-thumb が制御） */}
          <div className="mm-card mm-content-detail-thumb" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mm-primary-light)' }}>
            {content.thumbnail_url ? (
              <img src={content.thumbnail_url} alt={content.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            ) : content.content_type === 'video' ? (
              <VideoIcon size={64} color="var(--mm-accent)" />
            ) : (
              <ImageIcon size={64} color="var(--mm-accent)" />
            )}
          </div>

          {/* 詳細 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* コンテンツ情報 */}
            <div className="mm-card" style={{ padding: 28 }}>
              {/* eyebrow: 種別バッジ */}
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
                {content.content_type === 'video' ? '▷ Video' : '◇ Photo'}
              </p>
              <h1 className="font-serif-display" style={{
                fontSize: 'clamp(24px, 3vw, 32px)',
                fontWeight: 500,
                color: 'var(--mm-ink)', lineHeight: 1.3,
                marginBottom: 14, letterSpacing: '0.06em',
              }}>
                {content.title}
              </h1>
              {content.description && (
                <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.85, marginBottom: 20 }}>
                  {content.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 18, borderTop: '1px solid var(--mm-border)' }}>
                <span className="font-serif-display" style={{
                  fontSize: 38, fontWeight: 600, color: 'var(--mm-ink)', lineHeight: 1, letterSpacing: '-0.01em',
                }}>
                  <span style={{ fontSize: '0.6em', verticalAlign: '0.25em', marginRight: 2, color: 'var(--mm-text-muted)' }}>¥</span>
                  {content.price.toLocaleString()}
                </span>
                {content.stock_limit && (() => {
                  const remaining = Math.max(0, content.stock_limit - content.sold_count)
                  const low = !isSoldOut && remaining <= 3
                  return (
                    <span style={{
                      fontSize: low ? 12 : 11, letterSpacing: '0.1em',
                      color: isSoldOut ? '#dc2626' : low ? 'var(--mm-primary)' : 'var(--mm-text-muted)',
                      fontWeight: isSoldOut || low ? 700 : 500,
                    }}>
                      {isSoldOut ? 'Sold out' : `残り ${remaining} 点`}
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* 購入ボタン */}
            <PurchaseButton
              contentId={content.id}
              price={content.price}
              isPurchased={isPurchased}
              deliveryStatus={deliveryStatus}
              isSoldOut={isSoldOut}
              isLoggedIn={!!user}
              downloadUrl={downloadUrl}
            />

            {/* クリエイター */}
            {content.creator && (
              <div className="mm-card" style={{ padding: 22 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
                  Creator
                </p>
                <Link href={`/creator/${(content.creator as any).username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {content.creator.avatar_url ? (
                      <img src={content.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="font-serif-display" style={{ fontSize: 28, color: 'var(--mm-primary)' }}>{content.creator.display_name[0]}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--mm-ink)', marginBottom: 2 }}>{content.creator.display_name}</p>
                    {content.creator.bio && <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{content.creator.bio}</p>}
                  </div>
                </div>
                </Link>
                {(content.creator.twitter_url || content.creator.instagram_url || content.creator.tiktok_url) && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    {content.creator.twitter_url && (
                      <a href={content.creator.twitter_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--mm-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={13} /> X
                      </a>
                    )}
                    {content.creator.instagram_url && (
                      <a href={content.creator.instagram_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--mm-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={13} /> Instagram
                      </a>
                    )}
                    {content.creator.tiktok_url && (
                      <a href={content.creator.tiktok_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--mm-primary)' }}>
                        🎵 TikTok
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 同クリエイターの他のコンテンツ */}
        {relatedContents && relatedContents.length > 0 && (
          <div style={{ marginTop: 64 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
                  More from this creator
                </p>
                <h2 className="font-serif-display" style={{ fontSize: 24, fontWeight: 500, color: 'var(--mm-ink)', letterSpacing: '0.04em' }}>
                  {content.creator?.display_name} の他のコンテンツ
                </h2>
              </div>
              {content.creator && (
                <Link href={`/creator/${(content.creator as any).username ?? ''}`} style={{ fontSize: 13, color: 'var(--mm-text)', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid var(--mm-ink)', paddingBottom: 2 }}>
                  全て見る <span style={{ color: 'var(--mm-primary)' }}>→</span>
                </Link>
              )}
            </div>
            <div className="mm-content-grid">
              {relatedContents.map((c: any) => (
                <ContentCard key={c.id} content={c} isPurchased={purchasedIds.includes(c.id)} />
              ))}
            </div>
          </div>
        )}

        {/* レビュー */}
        <ReviewSection
          contentId={id}
          reviews={(reviews ?? []) as any}
          canReview={isPurchased}
          existingRating={myReview?.rating}
          existingComment={myReview?.comment ?? ''}
        />

        {/* コメント */}
        <div style={{ marginTop: 40 }}>
          <Comments contentId={id} comments={comments} currentUserId={user?.id ?? null} />
        </div>

        {/* おすすめクリエイター */}
        {recCreators && recCreators.length > 0 && (
          <div style={{ marginTop: 64 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
              Discover
            </p>
            <h2 className="font-serif-display" style={{ fontSize: 24, fontWeight: 500, color: 'var(--mm-ink)', marginBottom: 20, letterSpacing: '0.04em' }}>
              このクリエイターを見ている方へ
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {recCreators.map((c: any, i: number) => (
                <Link key={c.id} href={`/creator/${c.username}`} style={{ textDecoration: 'none' }}>
                  <div className="mm-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--mm-primary-light)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : c.display_name[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.display_name}</p>
                      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      <Footer />
    </div>
  )
}

