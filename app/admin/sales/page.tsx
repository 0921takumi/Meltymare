import { createClient } from '@/lib/supabase/server'

export default async function AdminSalesPage() {
  const supabase = await createClient()

  const { data: purchases } = await supabase
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
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>売上管理</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>総売上・手数料・振込予定額を確認できます</p>
      </div>

      {/* サマリー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'コンテンツ売上', value: `¥${totalContentSales.toLocaleString()}`, color: '#059669', note: `${purchases?.length ?? 0}件` },
          { label: 'チップ売上', value: `¥${totalTipSales.toLocaleString()}`, color: '#b8956a', note: `${tipCount}件のチップ` },
          { label: '運営手数料合計', value: `¥${totalFee.toLocaleString()}`, color: '#dc2626', note: 'コンテンツ代金に対してのみ' },
          { label: 'クリエイター支払合計', value: `¥${totalNet.toLocaleString()}`, color: 'var(--mm-primary)', note: '振込予定（チップ含む）' },
        ].map(s => (
          <div key={s.label} className="mm-card" style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{s.note}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* クリエイター別 */}
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 14 }}>
            クリエイター別売上
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--mm-bg)' }}>
                {['クリエイター', 'コンテンツ売上', 'チップ', '手数料', '振込額'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11,
                    color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creatorRanking.map(c => (
                <tr key={c.name} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 700 }}>¥{c.sales.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: '#b8956a', fontWeight: 700 }}>¥{c.tip.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: '#dc2626' }}>¥{c.fee.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--mm-primary)', fontWeight: 700 }}>¥{c.net.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 注文一覧 */}
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 14 }}>
            注文一覧（最新20件）
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--mm-bg)', position: 'sticky', top: 0 }}>
                  {['購入者', 'コンテンツ', '金額', '日時'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10,
                      color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases?.slice(0, 20).map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: 11 }}>{p.user?.display_name ?? '—'}</td>
                    <td style={{ padding: '9px 12px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.content?.title ?? '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#059669' }}>¥{p.amount.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--mm-text-muted)' }}>
                      {new Date(p.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
