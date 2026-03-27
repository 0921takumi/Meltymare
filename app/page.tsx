import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <section style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 60%, #8ab4d4 100%)',
        padding: '80px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 52, fontWeight: 600, color: 'white', letterSpacing: '0.08em', marginBottom: 16 }}>Meltymare</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.7 }}>キャストの特別な写真・動画を購入できるプラットフォーム</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>SNSには載せないコンテンツをあなただけに</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contents" style={{ background: 'white', color: 'var(--mm-primary)', padding: '14px 32px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>コンテンツを見る</Link>
            <Link href="/auth/signup" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '14px 32px', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)' }}>無料登録</Link>
          </div>
        </div>
      </section>
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, marginBottom: 40 }}>Meltymareでできること</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
          {[
            { icon: '📸', title: '限定写真・動画を購入', desc: 'SNSには載せない特別なコンテンツ。マイページで半永久的に保存できます。' },
            { icon: '🔒', title: '安全な決済', desc: 'Stripeによるクレジットカード決済。購入後は即時ダウンロード可能。' },
            { icon: '⭐', title: 'キャスト別に探せる', desc: 'お気に入りのキャストのページを直接チェック。新着コンテンツをすぐ確認。' },
          ].map((f, i) => (
            <div key={i} className="mm-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
