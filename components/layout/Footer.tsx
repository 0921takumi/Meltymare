import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ background: '#1a2f4a', color: 'rgba(255,255,255,0.6)', marginTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 24px' }}>
        {/* 上段 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32, marginBottom: 36 }}>
          <div>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: 'white', letterSpacing: '0.08em', marginBottom: 8 }}>
              MyFocus
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
              コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム
            </p>
          </div>

          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.1em', marginBottom: 12 }}>サービス</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: '/contents', label: 'コンテンツ一覧' },
                  { href: '/creators', label: 'クリエイター一覧' },
                  { href: '/search', label: '検索' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.1em', marginBottom: 12 }}>サポート</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: '/contact', label: 'お問い合わせ' },
                  { href: '/terms', label: '利用規約' },
                  { href: '/privacy', label: 'プライバシーポリシー' },
                  { href: '/tokushoho', label: '特定商取引法に基づく表記' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{label}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 下段 */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 12 }}>© 2025 株式会社91&amp;Co. All rights reserved.</p>
          <p style={{ fontSize: 12 }}>Powered by Stripe · Supabase</p>
        </div>
      </div>
    </footer>
  )
}
