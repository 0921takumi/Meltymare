import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Users, ShoppingBag, Wallet, Package, MessageSquare } from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 並行取得
  const [
    { count: totalUsers },
    { count: totalCreators },
    { data: purchases },
    { data: contents },
    { count: openInquiries },
    { data: recentPurchases },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
    supabase.from('purchases').select('amount').eq('status', 'completed'),
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('purchases')
      .select('*, content:contents(title, price), user:profiles(display_name, email)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalSales = purchases?.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const totalOrders = purchases?.length ?? 0

  const stats = [
    { icon: TrendingUp, label: '総売上',         value: `¥${totalSales.toLocaleString()}`, color: '#059669', bg: '#d1fae5' },
    { icon: ShoppingBag, label: '注文件数',       value: `${totalOrders}件`,               color: 'var(--mm-primary)', bg: 'var(--mm-primary-light)' },
    { icon: Users,       label: '会員数',         value: `${totalUsers ?? 0}名`,           color: '#7c3aed', bg: '#ede9fe' },
    { icon: Package,     label: 'クリエイター数', value: `${totalCreators ?? 0}名`,        color: '#d97706', bg: '#fef3c7' },
    { icon: MessageSquare, label: '未対応問い合わせ', value: `${openInquiries ?? 0}件`,   color: openInquiries ? '#dc2626' : 'var(--mm-text-muted)', bg: openInquiries ? '#fee2e2' : '#f3f4f6' },
  ]

  return (
    <div style={{ padding: '32px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>ダッシュボード</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>Meltymare 運営管理コンソール</p>
      </div>

      {/* KPIカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, marginBottom: 36 }}>
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="mm-card" style={{ padding: '20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--mm-text-muted)', fontWeight: 500 }}>{label}</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 最近の注文 */}
      <div className="mm-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 15 }}>
          最近の購入（直近10件）
        </div>
        {!recentPurchases || recentPurchases.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 14 }}>
            まだ購入データがありません
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--mm-bg)' }}>
                {['購入者', 'コンテンツ', '金額', '日時'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentPurchases.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                  <td style={{ padding: '11px 16px' }}>
                    <p style={{ fontWeight: 600 }}>{p.user?.display_name ?? '—'}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{p.user?.email}</p>
                  </td>
                  <td style={{ padding: '11px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.content?.title ?? '—'}
                  </td>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: '#059669' }}>
                    ¥{p.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--mm-text-muted)', fontSize: 12 }}>
                    {new Date(p.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
