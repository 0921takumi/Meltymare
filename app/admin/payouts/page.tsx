import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PayoutStatusChanger from './PayoutStatusChanger'
import { FINANCE } from '@/lib/config'
import { computePendingEarningsByCreator } from '@/lib/creator-earnings'

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

  // v29/v40: 既に振込済み(payout_id 設定済み)の購入・チップは「振込予定」から除外し、
  // 単発チップ(tipsテーブル)も加算する。admin/creators ページと計算がズレる事故が起きた
  // (2026-07)ため、集計ロジックは lib/creator-earnings.ts に一本化した。
  const pendingByCreator = await computePendingEarningsByCreator(supabase)

  // 振込履歴
  // 納品前監査で発覚: contents 用の FK ヒント(contents_creator_id_fkey)が一括置換でここにも入り、
  // PostgREST が PGRST200 を返して履歴が常に「0件」表示になっていた。履歴が出ない＝振込を
  // completed にする唯一のUI(PayoutStatusChanger)に到達できず、purchases.payout_id の紐付けが
  // 一度も走らない＝振込予定額が永遠に減らず二重払いを誘発する。payouts→profiles の制約名は
  // payouts_creator_id_fkey。error は握り潰さず、「0件」と「取得失敗」を画面で区別する。
  const { data: payouts, error: payoutsError } = await supabase
    .from('payouts')
    .select('*, creator:profiles!payouts_creator_id_fkey(display_name)')
    .order('created_at', { ascending: false })
    .limit(30)
  if (payoutsError) console.error('[admin/payouts] payouts query failed:', payoutsError.message)

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
      {payoutsError ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 20, color: '#991b1b', fontSize: 13, fontWeight: 600 }}>
          振込履歴を取得できませんでした（{payoutsError.message}）。0件ではなく取得エラーです。
        </div>
      ) : !payouts || payouts.length === 0 ? (
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
