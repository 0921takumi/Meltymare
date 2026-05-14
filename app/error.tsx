'use client'
import Link from 'next/link'

/**
 * 例外発生時のフォールバックページ。
 * App Router の規約で `error.tsx` を置くとここに自動フォールバック。
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
          5xx · Something went wrong
          <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
        </p>

        <p className="font-serif-display" style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(96px, 14vw, 168px)',
          fontWeight: 500, fontStyle: 'italic',
          color: 'var(--mm-ink)',
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          O<span style={{ color: 'var(--mm-primary)' }}>o</span>ps.
        </p>

        <h1 className="font-serif-display" style={{
          fontSize: 'clamp(20px, 2.5vw, 26px)',
          fontWeight: 500, fontStyle: 'italic',
          color: 'var(--mm-ink)',
          marginBottom: 14,
        }}>
          予期しないエラーが発生しました。
        </h1>

        <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', marginBottom: 36, lineHeight: 1.85, maxWidth: 400, margin: '0 auto 36px' }}>
          申し訳ありません。再試行してもダメな場合は、しばらく時間を置いてからお試しください。
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
          <button onClick={reset} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--mm-ink)', color: 'white',
            padding: '14px 30px', borderRadius: 999,
            fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
            border: 'none', cursor: 'pointer',
          }}>
            再試行
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18 }}>↻</span>
          </button>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'var(--mm-text)',
            padding: '14px 16px',
            fontWeight: 600, fontSize: 13,
            textDecoration: 'none',
            borderBottom: '1px solid var(--mm-ink)',
            letterSpacing: '0.04em',
          }}>
            トップへ戻る
          </Link>
        </div>

        {/* エラー digest（サポート問い合わせ時に使う） */}
        {error.digest && (
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
            error id: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
