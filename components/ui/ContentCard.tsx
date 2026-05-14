'use client'
import Link from 'next/link'
import { ImageIcon, VideoIcon, Lock } from 'lucide-react'
import type { Content } from '@/types'

interface ContentCardProps {
  content: Content
  isPurchased?: boolean
}

/**
 * ContentCard — エディトリアル雑誌風のコンテンツカード。
 *
 * デザイン方針:
 *   - サムネは 4:5 縦長（ポラロイドと呼応）。
 *   - クリエイター名は eyebrow ラベル（オレンジ罫線付き）。
 *   - 価格は Cormorant Garamond でディスプレイ感。
 *   - ホバーで Y方向に浮上＋影深まる。サムネは僅かにズーム。
 *   - 未購入時は中央に控えめなロックアイコンと "PREVIEW" 表記、
 *     ピンと張った黒線で「中身は見えない」ことを示唆。
 *   - SOLD OUT は赤地ではなく、エディトリアル風の打ち消し線で。
 */
export default function ContentCard({ content, isPurchased }: ContentCardProps) {
  const isSoldOut = content.stock_limit !== null && content.stock_limit !== undefined
    ? content.sold_count >= content.stock_limit
    : false
  const remaining = content.stock_limit ? Math.max(0, content.stock_limit - content.sold_count) : null
  const isLowStock = remaining !== null && remaining > 0 && remaining <= 3

  return (
    <Link href={`/contents/${content.id}`} className="mm-content-card" style={{ textDecoration: 'none', display: 'block' }}>
      {/* サムネイル */}
      <div className="mm-content-card-thumb">
        {content.thumbnail_url ? (
          <img src={content.thumbnail_url} alt={content.title} className="mm-content-card-img" />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: content.content_type === 'video'
              ? 'linear-gradient(135deg, #dcedf3 0%, #258eac 100%)'
              : 'linear-gradient(135deg, #fce9d8 0%, #d36b24 100%)',
          }}>
            {content.content_type === 'video'
              ? <VideoIcon size={36} color="white" strokeWidth={1.4} />
              : <ImageIcon size={36} color="white" strokeWidth={1.4} />}
          </div>
        )}

        {/* タイプバッジ（左上、控えめ） */}
        <span style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          background: 'rgba(255,255,255,0.92)', color: 'var(--mm-ink)',
          fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          backdropFilter: 'blur(8px)',
        }}>
          {content.content_type === 'video' ? '▷ Video' : '◇ Photo'}
        </span>

        {/* 購入済みバッジ */}
        {isPurchased && (
          <span style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            background: 'var(--mm-ink)', color: 'white',
            fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
            letterSpacing: '0.16em',
          }}>
            ✓ OWNED
          </span>
        )}

        {/* SOLD OUT オーバーレイ */}
        {isSoldOut && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 3,
            background: 'rgba(31, 26, 21, 0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}>
            <div style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 26, fontWeight: 500, fontStyle: 'italic',
              color: 'white', letterSpacing: '0.04em',
              textDecoration: 'line-through',
              textDecorationThickness: '1px',
              textUnderlineOffset: 6,
            }}>
              Sold out
            </div>
          </div>
        )}

        {/* 未購入時のロック表示（控えめ） */}
        {!isPurchased && !isSoldOut && (
          <div style={{
            position: 'absolute', bottom: 10, right: 10, zIndex: 2,
            background: 'rgba(255,255,255,0.92)',
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <Lock size={13} color="var(--mm-ink)" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="mm-content-card-body">
        {/* eyebrow: クリエイター名（オレンジ罫線） */}
        {content.creator && (
          <p className="mm-content-card-eyebrow">
            <span className="mm-content-card-eyebrow-line" />
            {content.creator.display_name}
          </p>
        )}

        {/* タイトル */}
        <p className="mm-content-card-title">
          {content.title}
        </p>

        {/* メタ行: 価格＋在庫 */}
        <div className="mm-content-card-meta">
          <span className="mm-content-card-price">
            <span style={{ fontSize: '0.65em', verticalAlign: '0.2em', marginRight: 1, color: 'var(--mm-text-muted)' }}>¥</span>
            {content.price.toLocaleString()}
          </span>
          {remaining !== null && (
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: isLowStock ? 'var(--mm-primary)' : 'var(--mm-text-muted)',
              fontWeight: isLowStock ? 700 : 500,
            }}>
              {isSoldOut ? 'Sold out' : `残 ${remaining}`}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
