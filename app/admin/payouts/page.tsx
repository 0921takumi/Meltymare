import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PayoutStatusChanger from './PayoutStatusChanger'
import { FINANCE } from '@/lib/config'

export default async function AdminPayoutsPage() {
  const supabase = await createClient()
  // v22: 振込先の銀行口座（PII）は service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()

  // クリエイターごとの振込予定額を計算
  const { data: creators } = await admin
    .from('profiles')
    .select('id, display_name, username, fee_rate, bank_name, bank_branch, bank_account_number, bank_account_holder')
    .eq('role', 'creator')

  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount, content:contents(creator_id, creator:profiles(fee_rate))')
    .eq('status', 'completed')

  // クリエイター別未払い集計
  const pendingByCreator: Record<string, { sales: number; net: number }> = {}
  purchases?.forEach((p: any) => {
    const creatorId = p.content?.creator_id
    const feeRate = p.content?.creator?.fee_rate ?? FINANCE.defaultFeeRate
    if (!creatorId) return
    if (!pendingByCreator[creatorId]) pendingByCreator[creatorId] = { sales: 0, net: 0 }
    pendingByCreator[creatorId].sales += p.amount
    pendingByCreator[creatorId].net += Math.floor(p.amount * (1 - feeRate / 100))
  })

  // 振込履歴
  const { data: payouts } = await supabase
    .from('payouts')
    .select('*, creator:profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <div className="admin-page">
      <h1 className="admin-h1">振込管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 28 }}>クリエイターへの振込予定・履歴を管理します</p>

      {/* 振込予定一覧 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        振込予定（クリエイター別）
      </h2>
      <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th>クリエイター</th>
              <th className="num">総売上</th>
              <th className="num">振込予定額</th>
              <th>手数料率</th>
              <th>振込先口座</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {creators?.map(c => {
              const stats = pendingByCreator[c.id] ?? { sales: 0, net: 0 }
              return (
                <tr key={c.id}>
                  <td data-label="クリエイター">
                    <p style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                  </td>
                  <td data-label="総売上" className="num" style={{ color: 'var(--mm-ink)', fontWeight: 700 }}>
                    ¥{stats.sales.toLocaleString()}
                  </td>
                  <td data-label="振込予定額" className="num" style={{ fontWeight: 700, color: 'var(--mm-primary)', fontSize: 15 }}>
                    ¥{stats.net.toLocaleString()}
                  </td>
                  <td data-label="手数料率">
                    <span style={{ background: 'var(--mm-primary-light)', color: 'var(--mm-primary)',
                      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {c.fee_rate}%
                    </span>
                  </td>
                  <td data-label="振込先口座" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {c.bank_name
                      ? `${c.bank_name} ${c.bank_branch ?? ''} ${c.bank_account_number ? '****' + c.bank_account_number.slice(-4) : ''}`
                      : <span style={{ color: '#f59e0b', fontWeight: 600 }}>口座未登録</span>}
                  </td>
                  <td data-label="状態">
                    {stats.net >= FINANCE.minPayoutYen
                      ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>振込可</span>
                      : stats.net > 0
                        ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700 }} title={`最低${FINANCE.minPayoutYen.toLocaleString()}円必要`}>繰越</span>
                        : <span style={{ color: 'var(--mm-text-muted)', fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 振込履歴 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        振込履歴
      </h2>
      {!payouts || payouts.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13 }}>
          振込履歴がありません
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>クリエイター</th>
                <th>対象期間</th>
                <th className="num">振込額</th>
                <th className="num">手数料</th>
                <th>ステータス</th>
                <th>振込日</th>
                <th>メモ</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="クリエイター" style={{ fontWeight: 600, color: 'var(--mm-ink)' }}>{p.creator?.display_name ?? '—'}</td>
                  <td data-label="対象期間" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {p.period_start} 〜 {p.period_end}
                  </td>
                  <td data-label="振込額" className="num" style={{ fontWeight: 700, color: 'var(--mm-primary)' }}>
                    ¥{p.net_amount.toLocaleString()}
                  </td>
                  <td data-label="手数料" className="num" style={{ color: 'var(--mm-text-muted)' }}>
                    ¥{p.fee_amount.toLocaleString()}
                  </td>
                  <td data-label="ステータス">
                    <PayoutStatusChanger payoutId={p.id} currentStatus={p.status} />
                  </td>
                  <td data-label="振込日" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td data-label="メモ" style={{ fontSize: 12 }}>{p.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
