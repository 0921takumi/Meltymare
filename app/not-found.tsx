import Link from 'next/link'

/**
 * 404 ページ — エディトリアル誌面風。
 * 「Page not found」を雑誌の落丁ページに見立ててデザイン。
 */
export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--mm-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="mm-grain" aria-hidden />
      <span className="mm-viewfinder-corner tl" aria-hidden />
      <span className="mm-viewfinder-corner tr" aria-hidden />
      <span className="mm-viewfinder-corner bl" aria-hidden />
      <span className="mm-viewfinder-corner br" aria-hidden />

      <div style={{ textAlign: 'center', maxWidth: 520, position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 28, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
          404 · Page Not Found
          <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
        </p>

        <p className="font-serif-display" style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(120px, 18vw, 220px)',
          fontWeight: 500, fontStyle: 'italic',
          color: 'var(--mm-ink)',
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          4<span style={{ color: 'var(--mm-primary)' }}>0</span>4
        </p>

        <h1 className="font-serif-display" style={{
          fontSize: 'clamp(22px, 3vw, 28px)',
          fontWeight: 500, fontStyle: 'italic',
          color: 'var(--mm-ink)',
          marginBottom: 14,
        }}>
          ページが見つかりませんでした。
        </h1>

        <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', marginBottom: 36, lineHeight: 1.85, maxWidth: 400, margin: '0 auto 36px' }}>
          お探しのページは引っ越したか、削除された可能性があります。<br />
          下のリンクから再開してください。
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--mm-ink)', color: 'white',
            padding: '14px 30px', borderRadius: 999,
            fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
            textDecoration: 'none',
          }}>
            トップへ戻る
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18 }}>→</span>
          </Link>
          <Link href="/contents" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'var(--mm-text)',
            padding: '14px 16px',
            fontWeight: 600, fontSize: 13,
            textDecoration: 'none',
            borderBottom: '1px solid var(--mm-ink)',
            letterSpacing: '0.04em',
          }}>
            コンテンツを見る
          </Link>
        </div>
      </div>
    </div>
  )
}
