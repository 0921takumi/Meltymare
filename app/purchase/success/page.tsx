import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function PurchaseSuccessPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="mm-card" style={{ maxWidth: 440, width: '100%', padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <CheckCircle size={56} color="#059669" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>購入が完了しました</h1>
        <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 32 }}>
          ありがとうございます。<br />
          購入したコンテンツはマイページからいつでもダウンロードできます。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/mypage" style={{ display: 'block', background: 'var(--mm-primary)', color: 'white', padding: '13px 24px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            マイページを見る
          </Link>
          <Link href="/contents" style={{ display: 'block', border: '1px solid var(--mm-border)', color: 'var(--mm-text-sub)', padding: '13px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            コンテンツ一覧に戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
