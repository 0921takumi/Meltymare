import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react'
import { COMPANY, CREATOR, CONTENT_GUIDELINES } from '@/lib/config'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'コンテンツガイドライン' }

export default function GuidelinesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />
      <div className="mm-page-pad" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← トップへ</Link>

        <div style={{ marginTop: 14, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Shield size={24} color="var(--mm-primary)" />
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>コンテンツガイドライン</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>
            {COMPANY.serviceName} で安全にコンテンツを販売・購入していただくためのルールです。
          </p>
        </div>

        {/* 年齢確認 */}
        <Section icon={<AlertTriangle size={18} color="#dc2626" />} title={`${CREATOR.minAge}歳未満は登録・利用不可`} severe>
          <p>
            {COMPANY.serviceName} は <strong>{CREATOR.minAge}歳以上</strong> のクリエイター・購入者のみ利用可能です。
            登録時に顔写真付き身分証（運転免許証・パスポート・マイナンバーカード等）の提出が必須となります。
            顔写真付き身分証が用意できない場合は、健康保険証＋住民票など <strong>{CREATOR.alternateIdRequiredCount}点</strong> の書類提出をお願いします。
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>{CREATOR.minAge}歳未満が含まれるコンテンツの投稿は、年齢偽装を含めて一切禁止</strong>します。違反時は即時アカウント停止・警察への通報を行います。
          </p>
        </Section>

        {/* モザイク必須 */}
        <Section icon={<Eye size={18} color="#f59e0b" />} title="性的描写を含む画像はモザイク必須">
          <p>
            性器・乳首・肛門など露出を伴う部位がある画像・動画は、<strong>モザイク処理（または黒塗り・ぼかし）が必須</strong>です。
            モザイクの基準は刑法175条わいせつ物頒布等罪に問われない「無修正に該当しない」レベルとし、判断に迷う場合は提出前に運営にご相談ください。
          </p>
          <p style={{ marginTop: 8 }}>
            運営は投稿された画像・動画の内容を審査のため閲覧することがあります。問題があるコンテンツは <strong>事前通知なしに非公開化</strong> される場合があります。
          </p>
        </Section>

        {/* 禁止コンテンツ */}
        <Section icon={<XCircle size={18} color="#dc2626" />} title="禁止コンテンツ" severe>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            {CONTENT_GUIDELINES.forbidden.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
            これらに違反したアカウントは <strong>事前警告なしに即時凍結</strong> され、悪質な場合は警察・法律事務所への通報を行います。
          </div>
        </Section>

        {/* 推奨される投稿 */}
        <Section icon={<CheckCircle size={18} color="#059669" />} title="推奨されるコンテンツ">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>クリエイター本人（またはクリエイター監督下）が制作したオリジナルコンテンツ</li>
            <li>購入者一人ひとりに向けたパーソナライズされた写真・動画・メッセージ</li>
            <li>ライブ配信・ストーリー・サブスク特典など継続的なファン体験</li>
            <li>コスプレ・チェキ・バースデーなど企画性のあるシリーズ</li>
          </ul>
        </Section>

        {/* 決済リスク */}
        <Section icon={<AlertTriangle size={18} color="#7c3aed" />} title="決済審査・リスクヘッジ">
          <p>
            一部のコンテンツ表現はクレジットカード会社のブランドルール（VISA/Master/JCB 等）により決済停止の対象となる可能性があります。
            運営は決済ブランドの審査基準に従い、収益化が認められないコンテンツについて <strong>事前通知の上で公開停止</strong> する場合があります。
          </p>
        </Section>

        {/* 通報・問い合わせ */}
        <Section icon={<Shield size={18} color="var(--mm-primary)" />} title="違反コンテンツの通報">
          <p>
            違反が疑われるコンテンツやコメントを発見した場合、各コンテンツ・コメントの <strong>「通報する」ボタン</strong> または下記窓口までご連絡ください。
          </p>
          <p style={{ marginTop: 8 }}>
            通報窓口: <a href={`mailto:${COMPANY.email}`} style={{ color: 'var(--mm-primary)' }}>{COMPANY.email}</a>
          </p>
        </Section>

        <div style={{ marginTop: 30, padding: 16, background: 'var(--mm-bg)', borderRadius: 8, fontSize: 11, color: 'var(--mm-text-muted)', textAlign: 'center' }}>
          このガイドラインは予告なく改定される場合があります。最終更新日: 2026年4月28日
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children, severe }: { icon: React.ReactNode; title: string; children: React.ReactNode; severe?: boolean }) {
  return (
    <section style={{
      marginBottom: 22,
      padding: 22,
      background: 'white',
      border: severe ? '2px solid #fecaca' : '1px solid var(--mm-border)',
      borderRadius: 12,
      borderLeft: severe ? '4px solid #dc2626' : '1px solid var(--mm-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {icon}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: severe ? '#991b1b' : 'var(--mm-text)' }}>{title}</h2>
      </div>
      <div style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  )
}
