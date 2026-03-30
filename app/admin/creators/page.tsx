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
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>クリエイター管理</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>手数料率・振込情報・売上を管理します</p>
      </div>

      <div className="mm-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--mm-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>在籍クリエイター ({creatorsWithStats.length}名)</span>
        </div>

        {creatorsWithStats.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 14 }}>
            クリエイターが登録されていません
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--mm-bg)' }}>
                {['クリエイター', '売上合計', '手数料率', '手数料額', '振込予定額', '振込先', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creatorsWithStats.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontWeight: 700 }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669' }}>
                    ¥{c.totalSales.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <FeeRateEditor creatorId={c.id} currentRate={c.fee_rate} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: 600 }}>
                    ¥{c.feeAmount.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--mm-primary)' }}>
                    ¥{c.netAmount.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {c.bank_name ? `${c.bank_name} ${c.bank_branch}` : <span style={{ color: '#f59e0b' }}>未登録</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <a href={`/admin/creators/${c.id}`} style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600, textDecoration: 'none' }}>
                      詳細 →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
