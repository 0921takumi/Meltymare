import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Order {
  id: string
  amount: number
  tip_amount: number | null
  status: string
  delivery_status: string | null
  created_at: string
  content: { id: string; title: string; thumbnail_url: string | null } | null
  user: { id: string; display_name: string; email: string; avatar_url: string | null } | null
  creator: { id: string; display_name: string; username: string } | null
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams
  // v22: 購入者の email（PII）を埋め込むため service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()

  const status = sp.status ?? 'all'
  const q = sp.q ?? ''
  const page = Number(sp.page ?? 1)
  const PER_PAGE = 50
  const offset = (page - 1) * PER_PAGE

  let query = admin
    .from('purchases')
    .select('id, amount, tip_amount, status, delivery_status, created_at, content:contents!inner(id, title, thumbnail_url, creator:profiles(id, display_name, username)), user:profiles!purchases_user_id_fkey(id, display_name, email, avatar_url)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PER_PAGE - 1)

  if (status !== 'all') query = query.eq('status', status)

  const { data: ordersData, count } = await query
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE)

  const orders = ((ordersData ?? []) as unknown as Array<Order & { content: NonNullable<Order['content']> & { creator: Order['creator'] } }>).map(o => ({
    ...o,
    creator: o.content?.creator ?? null,
  }))

  // 検索フィルタ（クライアントサイド: 購入者名・コンテンツ名）
  const filtered = q
    ? orders.filter(o =>
        (o.user?.display_name?.includes(q) ?? false) ||
        (o.user?.email?.includes(q) ?? false) ||
        (o.content?.title?.includes(q) ?? false)
      )
    : orders

  const totalAmount = filtered.reduce((s, o) => s + (o.amount ?? 0) + (o.tip_amount ?? 0), 0)

  return (
    <div className="admin-page">
      <h1 className="admin-h1">注文管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>すべての購入トランザクション</p>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { key: 'all', label: 'すべて' },
          { key: 'completed', label: '決済完了' },
          { key: 'pending', label: '保留' },
          { key: 'failed', label: '失敗' },
        ].map(t => (
          <Link key={t.key} href={`/admin/orders?status=${t.key}${q ? `&q=${q}` : ''}`} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: status === t.key ? 'var(--mm-primary)' : 'white',
            color: status === t.key ? 'white' : 'var(--mm-text-sub)',
            border: status === t.key ? 'none' : '1px solid var(--mm-border)',
            textDecoration: 'none',
          }}>{t.label}</Link>
        ))}
      </div>

      {/* 検索 */}
      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center' }}>
        <input type="hidden" name="status" value={status} />
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
          <input name="q" defaultValue={q} placeholder="購入者名・メール・コンテンツ名で検索"
            className="admin-input" style={{ paddingLeft: 36 }} />
        </div>
      </form>

      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>
        {filtered.length}件 / 合計 <strong style={{ color: 'var(--mm-ink)' }}>¥{totalAmount.toLocaleString()}</strong>
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th>購入者</th>
              <th>コンテンツ</th>
              <th>クリエイター</th>
              <th className="num">金額</th>
              <th>決済</th>
              <th>納品</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td data-label="購入者">
                  <p style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>{o.user?.display_name ?? '—'}</p>
                  <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{o.user?.email}</p>
                </td>
                <td data-label="コンテンツ" style={{ maxWidth: 220 }}>
                  <Link href={`/contents/${o.content?.id}`} style={{ color: 'var(--mm-ink)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}>
                    {o.content?.title ?? '—'}
                  </Link>
                </td>
                <td data-label="クリエイター">
                  {o.creator && <Link href={`/creator/${o.creator.username}`} style={{ color: 'var(--mm-text-sub)', textDecoration: 'none' }}>@{o.creator.display_name}</Link>}
                </td>
                <td data-label="金額" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>
                  ¥{((o.amount ?? 0) + (o.tip_amount ?? 0)).toLocaleString()}
                  {(o.tip_amount ?? 0) > 0 && <div style={{ fontSize: 10, color: 'var(--mm-primary)', fontWeight: 600 }}>+ Tip ¥{o.tip_amount?.toLocaleString()}</div>}
                </td>
                <td data-label="決済">
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: o.status === 'completed' ? '#d1fae5' : o.status === 'pending' ? '#fef3c7' : '#fee2e2',
                    color: o.status === 'completed' ? '#065f46' : o.status === 'pending' ? '#92400e' : '#991b1b',
                  }}>{o.status === 'completed' ? '完了' : o.status === 'pending' ? '保留' : '失敗'}</span>
                </td>
                <td data-label="納品">
                  {o.delivery_status === 'delivered' ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', padding: '3px 9px', background: '#d1fae5', borderRadius: 999 }}>納品済</span>
                  ) : o.delivery_status === 'pending' ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', padding: '3px 9px', background: '#fef3c7', borderRadius: 999 }}>納品待</span>
                  ) : <span style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>—</span>}
                </td>
                <td data-label="日時" style={{ color: 'var(--mm-text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(o.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 10).map(p => (
            <Link key={p} href={`/admin/orders?status=${status}&page=${p}${q ? `&q=${q}` : ''}`} style={{
              padding: '6px 11px', fontSize: 12, borderRadius: 6,
              background: p === page ? 'var(--mm-primary)' : 'white',
              color: p === page ? 'white' : 'var(--mm-text-sub)',
              border: '1px solid var(--mm-border)', textDecoration: 'none', fontWeight: 700,
            }}>{p}</Link>
          ))}
        </div>
      )}
    </div>
  )
}
