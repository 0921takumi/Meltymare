import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminSalesPage() {
  // v22: 購入者の email（PII）を含むため service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()

  const { data: purchases } = await admin
    .from('purchases')
    .select('*, content:contents(title, price, creator:profiles(display_name, fee_rate)), user:profiles(display_name, email)')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  // 手数料はコンテンツ代金のみにかかる。チップは手数料0%で全額クリエイターへ
  const getParts = (p: any) => {
    const contentPrice = p.content_price ?? p.amount ?? 0
    const tipAmount = p.tip_amount ?? 0
    const feeRate = p.content?.creator?.fee_rate ?? 30
    const fee = Math.floor(contentPrice * feeRate / 100)
    const net = contentPrice - fee + tipAmount
    return { contentPrice, tipAmount, feeRate, fee, net }
  }

  const totalContentSales = purchases?.reduce((sum, p) => sum + getParts(p).contentPrice, 0) ?? 0
  const totalTipSales = purchases?.reduce((sum, p) => sum + getParts(p).tipAmount, 0) ?? 0
  const totalSales = totalContentSales + totalTipSales
  const totalFee = purchases?.reduce((sum, p) => sum + getParts(p).fee, 0) ?? 0
  const totalNet = totalSales - totalFee
  const tipCount = purchases?.filter(p => (p.tip_amount ?? 0) > 0).length ?? 0

  // クリエイター別集計
  const byCreator: Record<string, { name: string; sales: number; tip: number; fee: number; net: number; count: number }> = {}
  purchases?.forEach(p => {
    const name = p.content?.creator?.display_name ?? '不明'
    const parts = getParts(p)
    if (!byCreator[name]) byCreator[name] = { name, sales: 0, tip: 0, fee: 0, net: 0, count: 0 }
    byCreator[name].sales += parts.contentPrice
    byCreator[name].tip += parts.tipAmount
    byCreator[name].fee += parts.fee
    byCreator[name].net += parts.net
    byCreator[name].count += 1
  })
  const creatorRanking = Object.values(byCreator).sort((a, b) => (b.sales + b.tip) - (a.sales + a.tip))

  return (
    <div className="admin-page">
      <h1 className="admin-h1">売上管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 28 }}>総売上・手数料・振込予定額を確認できます</p>

      {/* サマリー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
        {[
          { label: 'コンテンツ売上', value: totalContentSales, color: '#059669', note: `${purchases?.length ?? 0}件` },
          { label: 'チップ売上', value: totalTipSales, color: '#b8956a', note: `${tipCount}件のチップ` },
          { label: '運営手数料合計', value: totalFee, color: '#dc2626', note: 'コンテンツ代金に対してのみ' },
          { label: 'クリエイター支払合計', value: totalNet, color: 'var(--mm-primary)', note: '振込予定（チップ含む）' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12, padding: '18px 22px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>{s.label}</p>
            <p className="font-serif-display" style={{ fontSize: 30, fontWeight: 600, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: '0.55em', verticalAlign: '0.3em', marginRight: 2, opacity: 0.7 }}>¥</span>
              {s.value.toLocaleString()}
            </p>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 6 }}>{s.note}</p>
          </div>
        ))}
      </div>

      {/* クリエイター別売上 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        クリエイター別売上
      </h2>
      <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th>クリエイター</th>
              <th className="num">コンテンツ売上</th>
              <th className="num">チップ</th>
              <th className="num">手数料</th>
              <th className="num">振込額</th>
            </tr>
          </thead>
          <tbody>
            {creatorRanking.map(c => (
              <tr key={c.name}>
                <td data-label="クリエイター" style={{ fontWeight: 600, color: 'var(--mm-ink)' }}>{c.name}</td>
                <td data-label="コンテンツ売上" className="num" style={{ color: 'var(--mm-ink)', fontWeight: 700 }}>¥{c.sales.toLocaleString()}</td>
                <td data-label="チップ" className="num" style={{ color: '#b8956a', fontWeight: 700 }}>¥{c.tip.toLocaleString()}</td>
                <td data-label="手数料" className="num" style={{ color: '#dc2626' }}>¥{c.fee.toLocaleString()}</td>
                <td data-label="振込額" className="num" style={{ color: 'var(--mm-primary)', fontWeight: 700 }}>¥{c.net.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 注文一覧 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        注文一覧（最新20件）
      </h2>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th>購入者</th>
              <th>コンテンツ</th>
              <th className="num">金額</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {purchases?.slice(0, 20).map((p: any) => (
              <tr key={p.id}>
                <td data-label="購入者" style={{ fontWeight: 600, color: 'var(--mm-ink)' }}>{p.user?.display_name ?? '—'}</td>
                <td data-label="コンテンツ" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mm-text-sub)' }}>
                  {p.content?.title ?? '—'}
                </td>
                <td data-label="金額" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>¥{p.amount.toLocaleString()}</td>
                <td data-label="日時" style={{ color: 'var(--mm-text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(p.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
