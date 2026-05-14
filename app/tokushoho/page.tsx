import Header from '@/components/layout/Header'
import Link from 'next/link'
import type { Metadata } from 'next'
import { COMPANY, FINANCE } from '@/lib/config'

export const metadata: Metadata = { title: '特定商取引法に基づく表記' }

const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: '販売事業者', value: COMPANY.name },
  { label: '運営責任者', value: COMPANY.representative },
  { label: '所在地', value: `〒${COMPANY.postcode} ${COMPANY.address}` },
  {
    label: '連絡先',
    value: (
      <>
        メール: <a href={`mailto:${COMPANY.email}`} style={{ color: 'var(--mm-primary)' }}>{COMPANY.email}</a>
        <br />
        ※電話番号につきましては、お問い合わせを頂いた際に遅滞なく開示いたします。
      </>
    ),
  },
  {
    label: 'お問い合わせ受付時間',
    value: '平日 10:00〜18:00（土日祝・年末年始を除く）',
  },
  {
    label: '販売価格',
    value: '各商品ページに表示されている価格（すべて消費税込み）',
  },
  {
    label: '商品代金以外の必要料金',
    value: 'インターネット接続料金・通信料金等はお客様のご負担となります。',
  },
  {
    label: 'お支払い方法',
    value: 'クレジットカード決済（Visa / Mastercard / American Express / JCB / Diners Club）※決済代行: Stripe, Inc.',
  },
  {
    label: 'お支払い時期',
    value: '商品購入時にクレジットカード決済が実行されます。',
  },
  {
    label: '商品の引き渡し時期',
    value: '購入完了後、クリエイターが個別にパーソナルメッセージを添えて納品します。納期は各商品ページまたはクリエイターから案内される期間をご確認ください。',
  },
  {
    label: '返品・交換・キャンセルについて',
    value: (
      <>
        デジタルコンテンツの性質上、購入完了後のお客様都合によるキャンセル・返品・返金は原則としてお受けできません。
        <br />
        ただし以下の場合は個別に対応いたします。
        <br />
        ・ファイルが破損しているなど、当サービス側の不備により閲覧・利用できない場合
        <br />
        ・事前に案内された納期を大幅に超過しても納品が行われない場合
        <br />
        上記に該当する場合は、購入日（または納品予定日）から{FINANCE.refundWindowDays}日以内に
        <a href={`mailto:${COMPANY.email}`} style={{ color: 'var(--mm-primary)' }}>{COMPANY.email}</a> までご連絡ください。
      </>
    ),
  },
  {
    label: '応援チップについて',
    value: '商品代金に任意で0%・5%・10%・15%のチップを上乗せすることができます。チップは商品代金と合算して決済され、購入後の個別返金はできません。',
  },
  {
    label: '動作環境',
    value: '最新バージョンのGoogle Chrome / Safari / Microsoft Edge / Firefoxを推奨いたします。',
  },
]

export default function TokushohoPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />
      <div className="mm-page-pad" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← トップへ</Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>特定商取引法に基づく表記</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 6 }}>最終更新日: 2026年4月23日</p>
        </div>

        <div className="mm-card" style={{ padding: '32px 40px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={i} style={{ borderBottom: i === ROWS.length - 1 ? 'none' : '1px solid var(--mm-border)' }}>
                  <th style={{ textAlign: 'left', verticalAlign: 'top', padding: '16px 16px 16px 0', width: 180, fontWeight: 700, color: 'var(--mm-text)' }}>
                    {row.label}
                  </th>
                  <td style={{ padding: '16px 0', color: 'var(--mm-text-sub)', lineHeight: 1.8 }}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
