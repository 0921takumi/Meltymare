import Link from 'next/link'
import { ImageIcon, VideoIcon, Lock } from 'lucide-react'
import type { Content } from '@/types'

interface ContentCardProps {
  content: Content
  isPurchased?: boolean
}

export default function ContentCard({ content, isPurchased }: ContentCardProps) {
  const isSoldOut = content.stock_limit !== null && content.stock_limit !== undefined
    ? content.sold_count >= content.stock_limit
    : false

  return (
    <Link href={`/contents/${content.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="mm-card" style={{ transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(45,106,159,0.12)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'none'
          ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
        }}
      >
        {/* サムネイル */}
        <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--mm-primary-light)', overflow: 'hidden' }}>
          {content.thumbnail_url ? (
            <img src={content.thumbnail_url} alt={content.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {content.content_type === 'video'
                ? <VideoIcon size={32} color="var(--mm-accent)" />
                : <ImageIcon size={32} color="var(--mm-accent)" />}
            </div>
          )}

          {/* バッジ */}
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6 }}>
            <span style={{ background: content.content_type === 'video' ? '#7c3aed' : 'var(--mm-primary)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              {content.content_type === 'video' ? '動画' : '画像'}
            </span>
            {isSoldOut && (
              <span style={{ background: '#6b7280', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                SOLD OUT
              </span>
            )}
          </div>

          {/* 購入済みロック解除表示 */}
          {isPurchased && (
            <div style={{ position: 'absolute', top: 8, right: 8, background: '#059669', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              購入済み
            </div>
          )}
          {!isPurchased && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={13} color="white" />
            </div>
          )}
        </div>

        {/* 情報 */}
        <div style={{ padding: '12px 14px' }}>
          {/* クリエイター名 */}
          {content.creator && (
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>
              {content.creator.display_name}
            </p>
          )}
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--mm-text)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {content.title}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mm-primary)' }}>
              ¥{content.price.toLocaleString()}
            </span>
            {content.stock_limit && (
              <span style={{ fontSize: 11, color: isSoldOut ? '#dc2626' : 'var(--mm-text-muted)' }}>
                残り {Math.max(0, content.stock_limit - content.sold_count)} 枚
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
