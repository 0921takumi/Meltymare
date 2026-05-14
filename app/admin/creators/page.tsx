import { createClient } from '@/lib/supabase/server'
import FeeRateEditor from './FeeRateEditor'

export default async function AdminCreatorsPage() {
  const supabase = await createClient()

  const { data: creators } = await supabase
    .from('profiles')
    .select('*, contents(id, sold_count, price)')
    .eq('role', 'creator')
    .order('created_at', { ascending: false })

  const creatorsWithStats = creators?.map(c => {
    const contents = c.contents ?? []
    const totalSales = contents.reduce((sum: number, ct: any) => sum + ct.sold_count * ct.price, 0)
    const totalSold = contents.reduce((sum: number, ct: any) => sum + ct.sold_count, 0)
    const netAmount = Math.floor(totalSales * (1 - c.fee_rate / 100))
    const feeAmount = totalSales - netAmount
    return { ...c, totalSales, totalSold, netAmount, feeAmount, contents: undefined }
  }) ?? []

  return (
    <div className="admin-page">
      <h1 className="admin-h1">クリエイター管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>手数料率・振込情報・売上を管理します（在籍 {creatorsWithStats.length}名）</p>

      {creatorsWithStats.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13 }}>
          クリエイターが登録されていません
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>クリエイター</th>
                <th className="num">売上合計</th>
                <th>手数料率</th>
                <th className="num">手数料額</th>
                <th className="num">振込予定額</th>
                <th>振込先</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {creatorsWithStats.map((c: any) => (
                <tr key={c.id}>
                  <td data-label="クリエイター">
                    <p style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                  </td>
                  <td data-label="売上合計" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>
                    ¥{c.totalSales.toLocaleString()}
                  </td>
                  <td data-label="手数料率">
                    <FeeRateEditor creatorId={c.id} currentRate={c.fee_rate} />
                  </td>
                  <td data-label="手数料額" className="num" style={{ color: '#dc2626', fontWeight: 600 }}>
                    ¥{c.feeAmount.toLocaleString()}
                  </td>
                  <td data-label="振込予定額" className="num" style={{ fontWeight: 700, color: 'var(--mm-primary)' }}>
                    ¥{c.netAmount.toLocaleString()}
                  </td>
                  <td data-label="振込先" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {c.bank_name ? `${c.bank_name} ${c.bank_branch}` : <span style={{ color: '#f59e0b', fontWeight: 600 }}>未登録</span>}
                  </td>
                  <td data-label="操作">
                    <a href={`/admin/creators/${c.id}`} style={{ fontSize: 12, color: 'var(--mm-text)', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid var(--mm-ink)', paddingBottom: 1 }}>
                      詳細 <span style={{ color: 'var(--mm-primary)' }}>→</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
