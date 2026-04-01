'use client'
import Link from 'next/link'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>😵</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>エラーが発生しました</h1>
        <p style={{ fontSize: 14, color: 'var(--mm-text-muted)', marginBottom: 28, lineHeight: 1.7 }}>
          申し訳ありません。予期しないエラーが発生しました。<br />時間をおいて再度お試しください。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ padding: '12px 24px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            再試行
          </button>
          <Link href="/" style={{ padding: '12px 24px', background: 'white', color: 'var(--mm-text-sub)', border: '1px solid var(--mm-border)', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            トップへ
          </Link>
        </div>
      </div>
    </div>
  )
}
