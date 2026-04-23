import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: 'MyFocusの特定商取引法に基づく表記',
}

const ROWS: Array<[string, string]> = [
  ['販売業者', '株式会社91&Co.'],
  ['運営責任者', '（お問い合わせフォームよりご請求ください）'],
  ['所在地', '〒115-0043 東京都北区神谷2-21-7'],
  ['連絡先', 'お問い合わせフォーム: https://my-focus.jp/contact'],
  ['メールアドレス', 'info@my-focus.jp'],
  ['販売価格', '各商品ページに表示された金額（消費税込み）'],
  ['商品代金以外の必要料金', '決済時の振込手数料はお客様負担となる場合があります。その他追加料金はありません。'],
  ['支払方法', 'クレジットカード決済（Stripe社を通じて実施）'],
  ['支払時期', 'ご注文確定時に決済が実行されます'],
  ['商品の引渡し時期', 'クリエイターが注文内容を確認のうえ、原則2週間以内にデジタルコンテンツとして納品します。納品後マイページよりダウンロードいただけます。'],
  ['返品・キャンセル', 'デジタルコンテンツの性質上、納品後のキャンセル・返品は原則お受けできません。納品期限を過ぎても納品がない場合は、自動的にキャンセル・全額返金となります。'],
  ['動作環境', 'モダンブラウザ（Chrome / Safari / Firefox / Edge 最新版）の閲覧を推奨。コンテンツ形式はJPEG / PNG / MP4 等。'],
  ['特別条件', '18歳未満の方は保護者の同意のもとご利用ください。コンテンツの第三者への譲渡・再配布・複製は禁止します。'],
]

export default async function TokushohoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>特定商取引法に基づく表記</h1>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 24 }}>最終更新日: 2026年4月23日</p>

        <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {ROWS.map(([label, value], i) => (
                <tr key={label} style={{ borderBottom: i === ROWS.length - 1 ? 'none' : '1px solid var(--mm-border)' }}>
                  <th
                    style={{
                      padding: '14px 16px', textAlign: 'left', verticalAlign: 'top',
                      width: 200, background: 'var(--mm-bg)', color: 'var(--mm-text-sub)',
                      fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </th>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top', lineHeight: 1.7 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 20, lineHeight: 1.7 }}>
          本表記に関するお問い合わせは <a href="/contact" style={{ color: 'var(--mm-primary)' }}>お問い合わせフォーム</a> までご連絡ください。
        </p>
      </div>

      <Footer />
    </div>
  )
}
