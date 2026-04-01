import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 100, fontWeight: 600, color: 'var(--mm-primary)', lineHeight: 1, marginBottom: 8, opacity: 0.25 }}>
          404
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--mm-text)' }}>
          ページが見つかりません
        </h1>
        <p style={{ fontSize: 14, color: 'var(--mm-text-muted)', marginBottom: 32, lineHeight: 1.7 }}>
          お探しのページは存在しないか、削除された可能性があります。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{ padding: '12px 28px', background: 'var(--mm-primary)', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            トップへ戻る
          </Link>
          <Link href="/contents" style={{ padding: '12px 28px', background: 'white', color: 'var(--mm-primary)', border: '1px solid var(--mm-primary)', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            コンテンツを見る
          </Link>
        </div>
      </div>
    </div>
  )
}
