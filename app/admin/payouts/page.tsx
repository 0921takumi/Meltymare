import { createClient } from '@/lib/supabase/server'
import PayoutStatusChanger from './PayoutStatusChanger'

export default async function AdminPayoutsPage() {
  const supabase = await createClient()

  // クリエイターごとの振込予定額を計算
  const { data: creators } = await supabase
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
    const feeRate = p.content?.creator?.fee_rate ?? 30
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
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>振込管理</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>クリエイターへの振込予定・履歴を管理します</p>
      </div>

      {/* 振込予定一覧 */}
      <div className="mm-card" style={{ overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 14 }}>
          振込予定（クリエイター別）
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--mm-bg)' }}>
              {['クリエイター', '総売上', '振込予定額', '手数料率', '振込先口座', '状態'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11,
                  color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creators?.map(c => {
              const stats = pendingByCreator[c.id] ?? { sales: 0, net: 0 }
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontWeight: 700 }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{c.username}</p>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 700 }}>
                    ¥{stats.sales.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--mm-primary)', fontSize: 15 }}>
                    ¥{stats.net.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'var(--mm-primary-light)', color: 'var(--mm-primary)',
                      padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {c.fee_rate}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {c.bank_name
                      ? `${c.bank_name} ${c.bank_branch ?? ''} ${c.bank_account_number ? '****' + c.bank_account_number.slice(-4) : ''}`
                      : <span style={{ color: '#f59e0b', fontWeight: 600 }}>口座未登録</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {stats.net > 0
                      ? <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>振込待ち</span>
                      : <span style={{ color: 'var(--mm-text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 振込履歴 */}
      <div className="mm-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 14 }}>
          振込履歴
        </div>
        {!payouts || payouts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 14 }}>
            振込履歴がありません
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--mm-bg)' }}>
                {['クリエイター', '対象期間', '振込額', '手数料', 'ステータス', '振込日', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 600 }}>{p.creator?.display_name ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {p.period_start} 〜 {p.period_end}
                  </td>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--mm-primary)' }}>
                    ¥{p.net_amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#dc2626' }}>
                    ¥{p.fee_amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <PayoutStatusChanger payoutId={p.id} currentStatus={p.status} />
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--mm-text-muted)' }}>
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 12 }}>{p.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
