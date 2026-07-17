import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, ShieldAlert } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import FeeRateEditor from '../FeeRateEditor'
import { computePendingEarningsByCreator } from '@/lib/creator-earnings'
import { fetchAllRows } from '@/lib/fetch-all'
import { FINANCE } from '@/lib/config'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f-]{36}$/i

const IDENTITY_META: Record<string, { label: string; color: string; bg: string }> = {
  unsubmitted: { label: '未提出', color: 'var(--mm-text-muted)', bg: 'var(--mm-bg)' },
  pending:     { label: '審査待ち', color: '#d97706', bg: '#fef3c7' },
  approved:    { label: '承認済み', color: '#059669', bg: '#d1fae5' },
  rejected:    { label: '却下',     color: '#dc2626', bg: '#fee2e2' },
}

const ACTION_LABELS: Record<string, string> = {
  user_suspend: 'ユーザー凍結',
  user_unsuspend: '凍結解除',
  role_change: 'ロール変更',
}

export default async function AdminCreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  // v22: PII列(email/bank_*/identity_*/is_suspended)を含むため service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()

  const { data: creator } = await admin.from('profiles').select('*').eq('id', id).eq('role', 'creator').maybeSingle()
  // 凍結・削除済みでも管理者には見えている必要があるため、公開ページ(creator/[username])と
  // 異なりここでは is_suspended/deleted_at では 404 にしない。id が creator と一致しない時のみ404。
  if (!creator) notFound()

  const { data: contents } = await admin
    .from('contents')
    .select('id, title, price, sold_count, review_status, is_published, created_at')
    .eq('creator_id', id)
    .order('created_at', { ascending: false })

  const contentIds = (contents ?? []).map(c => c.id)

  const [earningsByCreator, recentOrders, payoutHistory, adminActions] = await Promise.all([
    computePendingEarningsByCreator(admin),
    contentIds.length > 0
      ? fetchAllRows((from, to) => admin
          .from('purchases')
          .select('id, amount, content_price, tip_amount, delivery_status, created_at, user:profiles!purchases_user_id_fkey(display_name), content:contents(title)')
          .in('content_id', contentIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .range(from, to))
        .then(rows => rows.slice(0, 20))
      : Promise.resolve([]),
    admin.from('payouts').select('*').eq('creator_id', id).order('created_at', { ascending: false }).limit(10)
      .then(r => r.data ?? []),
    admin.from('admin_actions')
      .select('id, action_type, detail, created_at, admin:profiles!admin_actions_admin_id_fkey(display_name)')
      .eq('target_type', 'user').eq('target_id', id)
      .order('created_at', { ascending: false }).limit(20)
      .then(r => r.data ?? []),
  ])

  const earnings = earningsByCreator[id] ?? { sales: 0, fee: 0, net: 0 }
  const identityStatus = creator.identity_status ?? 'unsubmitted'
  const identityMeta = IDENTITY_META[identityStatus] ?? IDENTITY_META.unsubmitted

  return (
    <div className="admin-page">
      <Link href="/admin/creators" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none', marginBottom: 16 }}>
        <ArrowLeft size={14} /> クリエイター管理へ戻る
      </Link>

      {/* ヘッダー */}
      <div className="mm-card" style={{ padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Avatar src={creator.avatar_url} name={creator.display_name} size={56} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="admin-h1" style={{ marginBottom: 2 }}>{creator.display_name}</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>@{creator.username} · 登録日 {new Date(creator.created_at).toLocaleDateString('ja-JP')}</p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 11px', borderRadius: 999, background: identityMeta.bg, color: identityMeta.color }}>
          本人確認: {identityMeta.label}
        </span>
        {creator.is_suspended && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 11px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} />凍結中
          </span>
        )}
      </div>

      {creator.is_suspended && (
        <div style={{ marginBottom: 20, padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ShieldAlert size={18} color="#dc2626" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>このアカウントは凍結されています</p>
            {creator.suspended_reason && <p style={{ fontSize: 12, color: '#991b1b', marginTop: 2 }}>理由: {creator.suspended_reason}</p>}
          </div>
          <Link href={`/admin/users?q=${encodeURIComponent(creator.username)}`} style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            凍結解除はユーザー管理へ →
          </Link>
        </div>
      )}

      {/* 財務サマリー（振込予定＝未払い分のみ。lib/creator-earnings.ts で一括計算） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'コンテンツ数', value: `${contents?.length ?? 0} 件`, color: 'var(--mm-primary)' },
          { label: '振込予定の総売上', value: `¥${earnings.sales.toLocaleString()}`, color: '#059669' },
          { label: '手数料額', value: `¥${earnings.fee.toLocaleString()}`, color: '#dc2626' },
          { label: '振込予定額', value: `¥${earnings.net.toLocaleString()}`, color: 'var(--mm-primary)' },
        ].map(s => (
          <div key={s.label} className="mm-card" style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 19, fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 手数料率・振込先 */}
      <div className="mm-card" style={{ padding: '18px 22px', marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>手数料率</p>
          <FeeRateEditor creatorId={creator.id} currentRate={creator.fee_rate} />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>振込先口座</p>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>
            {creator.bank_name
              ? `${creator.bank_name} ${creator.bank_branch ?? ''} ${creator.bank_account_number ? '****' + String(creator.bank_account_number).slice(-4) : ''} ${creator.bank_account_holder ?? ''}`.trim()
              : <span style={{ color: '#f59e0b', fontWeight: 600 }}>口座未登録</span>}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>振込可否</p>
          {earnings.net >= FINANCE.minPayoutYen
            ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>振込可</span>
            : <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }} title={`最低${FINANCE.minPayoutYen.toLocaleString()}円必要`}>繰越</span>}
        </div>
      </div>

      {/* 本人確認 */}
      <div className="mm-card" style={{ padding: '18px 22px', marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>本人確認</p>
        <p style={{ fontSize: 12, color: 'var(--mm-text-sub)' }}>
          {creator.identity_submitted_at ? `提出: ${new Date(creator.identity_submitted_at).toLocaleString('ja-JP')}` : '未提出'}
          {creator.identity_reviewed_at && ` ／ 審査済: ${new Date(creator.identity_reviewed_at).toLocaleString('ja-JP')}`}
        </p>
        {identityStatus === 'rejected' && creator.identity_rejection_reason && (
          <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>却下理由: {creator.identity_rejection_reason}</p>
        )}
        <Link href="/admin/verifications?filter=all" style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-primary)', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
          本人確認の詳細・書類を見る →
        </Link>
      </div>

      {/* コンテンツ一覧 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        コンテンツ（{contents?.length ?? 0}件）
      </h2>
      {!contents || contents.length === 0 ? (
        <div className="mm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13, marginBottom: 28 }}>
          コンテンツがありません
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 28 }}>
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>タイトル</th>
                <th className="num">価格</th>
                <th className="num">販売数</th>
                <th>審査状況</th>
                <th>公開</th>
                <th>登録日</th>
              </tr>
            </thead>
            <tbody>
              {contents.map((c: any) => (
                <tr key={c.id}>
                  <td data-label="タイトル">
                    <a href={`/contents/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mm-ink)', fontWeight: 600, textDecoration: 'none', maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                      {c.title}
                    </a>
                  </td>
                  <td data-label="価格" className="num">¥{c.price.toLocaleString()}</td>
                  <td data-label="販売数" className="num">{c.sold_count}</td>
                  <td data-label="審査状況">
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                      background: c.review_status === 'approved' ? '#d1fae5' : c.review_status === 'rejected' ? '#fee2e2' : '#fef3c7',
                      color: c.review_status === 'approved' ? '#065f46' : c.review_status === 'rejected' ? '#991b1b' : '#92400e' }}>
                      {c.review_status === 'approved' ? '承認済み' : c.review_status === 'rejected' ? '却下' : '審査待ち'}
                    </span>
                  </td>
                  <td data-label="公開">{c.is_published ? '公開中' : '非公開'}</td>
                  <td data-label="登録日" style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{new Date(c.created_at).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 最近の注文 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        最近の注文（最新20件）
      </h2>
      {recentOrders.length === 0 ? (
        <div className="mm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13, marginBottom: 28 }}>
          注文がありません
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 28 }}>
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>購入者</th>
                <th>コンテンツ</th>
                <th className="num">金額</th>
                <th>納品状況</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="購入者" style={{ fontWeight: 600, color: 'var(--mm-ink)' }}>{p.user?.display_name ?? '—'}</td>
                  <td data-label="コンテンツ" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mm-text-sub)' }}>{p.content?.title ?? '—'}</td>
                  <td data-label="金額" className="num" style={{ fontWeight: 700 }}>
                    ¥{p.amount.toLocaleString()}
                    {(p.tip_amount ?? 0) > 0 && <span style={{ fontSize: 10, color: '#b8956a', marginLeft: 4 }}>(チップ¥{p.tip_amount.toLocaleString()})</span>}
                  </td>
                  <td data-label="納品状況" style={{ fontSize: 11, color: p.delivery_status === 'delivered' ? '#059669' : '#d97706' }}>
                    {p.delivery_status === 'delivered' ? '納品済み' : '未納品'}
                  </td>
                  <td data-label="日時" style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{new Date(p.created_at).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 振込履歴 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        振込履歴
      </h2>
      {payoutHistory.length === 0 ? (
        <div className="mm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13, marginBottom: 28 }}>
          振込履歴がありません
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 28 }}>
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>対象期間</th>
                <th className="num">振込額</th>
                <th>ステータス</th>
                <th>振込日</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="対象期間" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>{p.period_start} 〜 {p.period_end}</td>
                  <td data-label="振込額" className="num" style={{ fontWeight: 700, color: 'var(--mm-primary)' }}>¥{p.net_amount.toLocaleString()}</td>
                  <td data-label="ステータス" style={{ fontSize: 12 }}>{p.status}</td>
                  <td data-label="振込日" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ja-JP') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 管理操作ログ（このユーザー対象のみ） */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        管理操作ログ
      </h2>
      {adminActions.length === 0 ? (
        <div className="mm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13 }}>
          このユーザーに対する管理操作はありません
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-mobile-card">
            <thead>
              <tr>
                <th>日時</th>
                <th>管理者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {adminActions.map((a: any) => (
                <tr key={a.id}>
                  <td data-label="日時" style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{new Date(a.created_at).toLocaleString('ja-JP')}</td>
                  <td data-label="管理者" style={{ fontSize: 12, fontWeight: 600 }}>{a.admin?.display_name ?? '—'}</td>
                  <td data-label="操作" style={{ fontSize: 12 }}>{ACTION_LABELS[a.action_type] ?? a.action_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
