import { createAdminClient } from '@/lib/supabase/admin'
import FeeRateEditor from './FeeRateEditor'
import { computePendingEarningsByCreator } from '@/lib/creator-earnings'

export default async function AdminCreatorsPage() {
  // v22: 振込先の銀行口座（PII）を含むため service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()

  const { data: creators } = await admin
    .from('profiles')
    .select('*')
    .eq('role', 'creator')
    .order('created_at', { ascending: false })

  // 監査で発覚(2026-07): 従来は contents.sold_count * contents.price という現在価格ベースの
  // 概算計算で、購入付随チップ・単発チップ・クーポン割引・手数料率スナップショットが
  // 一切反映されていなかった（本来の購入台帳と乖離し、実データで最大23倍も乖離するケースを確認）。
  // admin/payouts と同じ実データ集計ロジックに統一する。
  const earnings = await computePendingEarningsByCreator(admin)

  const creatorsWithStats = creators?.map(c => {
    const e = earnings[c.id] ?? { sales: 0, fee: 0, net: 0 }
    return { ...c, totalSales: e.sales, netAmount: e.net, feeAmount: e.fee }
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
                    {c.bank_name ? `${c.bank_name} ${c.bank_branch ?? ''}`.trim() : <span style={{ color: '#f59e0b', fontWeight: 600 }}>未登録</span>}
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
