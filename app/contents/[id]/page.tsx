import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import PurchaseButton from './PurchaseButton'
import { notFound } from 'next/navigation'
import { ImageIcon, VideoIcon, ExternalLink } from 'lucide-react'

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  const { data: content } = await supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, avatar_url, bio, twitter_url, instagram_url, tiktok_url)')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (!content) return notFound()

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
      const { data: urlData } = await supabase.storage
        .from('deliveries')
        .createSignedUrl((purchase as any).delivered_file_url, 3600)
      downloadUrl = urlData?.signedUrl ?? null
    }
  }

  const isSoldOut = content.stock_limit != null && content.sold_count >= content.stock_limit

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="mm-content-detail" style={{ alignItems: 'start' }}>

          {/* サムネイル */}
          <div className="mm-card" style={{ overflow: 'hidden', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mm-primary-light)' }}>
            {content.thumbnail_url ? (
              <img src={content.thumbnail_url} alt={content.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : content.content_type === 'video' ? (
              <VideoIcon size={64} color="var(--mm-accent)" />
            ) : (
              <ImageIcon size={64} color="var(--mm-accent)" />
            )}
          </div>

          {/* 詳細 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* コンテンツ情報 */}
            <div className="mm-card" style={{ padding: 24 }}>
              <span style={{ display: 'inline-block', background: content.content_type === 'video' ? '#7c3aed' : 'var(--mm-primary)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, marginBottom: 12 }}>
                {content.content_type === 'video' ? '動画' : '画像'}
              </span>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, lineHeight: 1.4 }}>{content.title}</h1>
              {content.description && (
                <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 16 }}>{content.description}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--mm-border)' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--mm-primary)' }}>¥{content.price.toLocaleString()}</span>
                {content.stock_limit && (
                  <span style={{ fontSize: 12, color: isSoldOut ? '#dc2626' : 'var(--mm-text-muted)' }}>
                    残り {Math.max(0, content.stock_limit - content.sold_count)} 枚
                  </span>
                )}
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
              <div className="mm-card" style={{ padding: 20 }}>
                <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 10 }}>クリエイター</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {content.creator.avatar_url ? (
                      <img src={content.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 18 }}>👤</span>
                    )}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{content.creator.display_name}</p>
                    {content.creator.bio && <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>{content.creator.bio}</p>}
                  </div>
                </div>
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
      </div>
    </div>
  )
}
