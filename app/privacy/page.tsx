import Header from '@/components/layout/Header'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'プライバシーポリシー' }

const SECTIONS = [
  {
    title: '1. 収集する情報',
    content: '当サービスは以下の情報を収集します。①アカウント登録時にご提供いただくメールアドレス・表示名、②プロフィール情報（任意）、③サービス利用時のアクセスログ・利用履歴、④決済に関する情報（クレジットカード情報はStripeが直接管理し、当サービスは保持しません）。'
  },
  {
    title: '2. 情報の利用目的',
    content: '収集した情報は以下の目的で使用します。①サービスの提供・運営、②ユーザー認証・本人確認、③購入・納品処理、④カスタマーサポート対応、⑤サービス改善・新機能開発、⑥メール通知（購入完了・納品完了等）、⑦不正利用の検知・防止。'
  },
  {
    title: '3. 第三者への提供',
    content: '当サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。①ユーザーの同意がある場合、②法令に基づく場合、③人の生命・身体・財産の保護に必要な場合。決済処理にはStripe, Inc.を利用しており、決済情報はStripeのプライバシーポリシーに基づき管理されます。'
  },
  {
    title: '4. Cookieの使用',
    content: '当サービスはCookieを使用してセッション管理・ユーザー認証を行います。ブラウザの設定でCookieを無効にすることができますが、その場合サービスの一部機能が利用できなくなる場合があります。'
  },
  {
    title: '5. データの保管・セキュリティ',
    content: 'ユーザー情報はSupabase（PostgreSQL）に安全に保存されます。SSL/TLS暗号化通信を採用し、不正アクセス防止策を講じています。ただし、インターネット上の通信において完全なセキュリティを保証することはできません。'
  },
  {
    title: '6. データの削除・変更',
    content: 'ユーザーはいつでもプロフィール情報の変更・削除を行うことができます。アカウント削除をご希望の場合はお問い合わせフォームよりご連絡ください。法令上保存が必要なデータについては一定期間保持する場合があります。'
  },
  {
    title: '7. お問い合わせ',
    content: '個人情報の取り扱いに関するお問い合わせは、サービス内のお問い合わせフォームよりご連絡ください。'
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />
      <div className="mm-page-pad" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← トップへ</Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>プライバシーポリシー</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 6 }}>最終更新日: 2025年4月1日</p>
        </div>

        <div className="mm-card" style={{ padding: '32px 40px' }}>
          <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8, marginBottom: 32 }}>
            Meltymare（以下「当サービス」）は、ユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>

          {SECTIONS.map((s, i) => (
            <div key={i} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--mm-text)' }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8 }}>{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
