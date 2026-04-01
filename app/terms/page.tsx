import Header from '@/components/layout/Header'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '利用規約' }

const SECTIONS = [
  {
    title: '第1条（適用）',
    content: '本規約は、Meltymare（以下「当サービス」）が提供するサービスの利用条件を定めるものです。登録ユーザーの皆様には、本規約に従って当サービスをご利用いただきます。'
  },
  {
    title: '第2条（利用登録）',
    content: '登録希望者が当サービスの定める方法によって利用登録を申請し、当サービスがこれを承認することによって、利用登録が完了するものとします。未成年者の方は、保護者の同意を得てから登録してください。'
  },
  {
    title: '第3条（コンテンツの購入）',
    content: 'ユーザーはクリエイターが出品するコンテンツを購入することができます。購入後は、クリエイターがパーソナルメッセージを添えてコンテンツを納品します。購入完了後のキャンセルは原則としてお受けできません。'
  },
  {
    title: '第4条（禁止事項）',
    content: '以下の行為を禁止します。①法令または公序良俗に違反する行為、②犯罪行為に関連する行為、③当サービスのサーバーまたはネットワークの機能を破壊・妨害する行為、④他のユーザーに関する個人情報等を収集または蓄積する行為、⑤不正アクセスをする行為、⑥当サービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為。'
  },
  {
    title: '第5条（コンテンツの著作権）',
    content: '当サービス上に掲載されたコンテンツの著作権は、各クリエイターに帰属します。購入したコンテンツは個人的な使用に限られ、無断転載・再配布は禁止します。'
  },
  {
    title: '第6条（サービスの停止）',
    content: '当サービスは、以下の場合にサービスの全部または一部を停止・中断することがあります。①システムの保守点検または更新を行う場合、②地震・落雷・火災等の天災による場合、③その他当サービスがサービスの停止または中断が必要と判断した場合。'
  },
  {
    title: '第7条（免責事項）',
    content: '当サービスは、当サービスに起因してユーザーに生じたあらゆる損害について一切の責任を負いません。ただし、当サービスに関するユーザーとの契約が消費者契約法に定める消費者契約となる場合、この免責規定は適用されません。'
  },
  {
    title: '第8条（規約の変更）',
    content: '当サービスは必要に応じて本規約を変更することができるものとします。変更後の本規約はウェブサイト上に掲示した時点から効力を生じるものとします。'
  },
]

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />
      <div className="mm-page-pad" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← トップへ</Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>利用規約</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 6 }}>最終更新日: 2025年4月1日</p>
        </div>

        <div className="mm-card" style={{ padding: '32px 40px' }}>
          <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8, marginBottom: 32 }}>
            本利用規約（以下「本規約」）は、Meltymare（以下「当サービス」）がこのウェブサイト上で提供するサービス（以下「本サービス」）の利用条件を定めるものです。登録ユーザーの皆様（以下「ユーザー」）には、本規約に従って、本サービスをご利用いただきます。
          </p>

          {SECTIONS.map((s, i) => (
            <div key={i} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--mm-text)' }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8 }}>{s.content}</p>
            </div>
          ))}

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--mm-border)', fontSize: 13, color: 'var(--mm-text-muted)' }}>
            <p>以上</p>
          </div>
        </div>
      </div>
    </div>
  )
}
