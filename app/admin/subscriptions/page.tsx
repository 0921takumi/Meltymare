import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Gem, Users, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PlanRow {
  id: string
  name: string
  monthly_price: number
  is_active: boolean
  member_count: number
  badge_emoji: string
  badge_color: string
  created_at: string
  creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
}

interface SubRow {
  id: string
  status: string
  started_at: string
  current_period_end: string
  user: { display_name: string; email: string; avatar_url: string | null } | null
  creator: { display_name: string; username: string } | null
  plan: { name: string; monthly_price: number } | null
}

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient()
  // v22: 加入者の email（PII）を埋め込むクエリは service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()

  const [{ data: plansData }, { data: subsData }, { data: allSubs }] = await Promise.all([
    supabase.from('subscription_plans')
      .select('*, creator:profiles!subscription_plans_creator_id_fkey(id, display_name, username, avatar_url)')
      .order('member_count', { ascending: false }).limit(50),
    admin.from('subscriptions')
      .select('id, status, started_at, current_period_end, user:profiles!subscriptions_user_id_fkey(display_name, email, avatar_url), creator:profiles!subscriptions_creator_id_fkey(display_name, username), plan:subscription_plans(name, monthly_price)')
      .eq('status', 'active')
      .order('started_at', { ascending: false }).limit(30),
    supabase.from('subscriptions').select('plan_id, status, plan:subscription_plans(monthly_price)'),
  ])

  const plans = (plansData ?? []) as unknown as PlanRow[]
  const recentSubs = (subsData ?? []) as unknown as SubRow[]

  // MRR 計算
  let mrr = 0
  let activeCount = 0
  let cancelledCount = 0
  for (const s of (allSubs ?? []) as unknown as { status: string; plan: { monthly_price: number } | null }[]) {
    if (s.status === 'active') {
      mrr += s.plan?.monthly_price ?? 0
      activeCount++
    } else if (s.status === 'cancelled') {
      cancelledCount++
    }
  }
  const churnRate = activeCount + cancelledCount > 0 ? (cancelledCount / (activeCount + cancelledCount) * 100).toFixed(1) : '0'

  return (
    <div className="admin-page">
      <h1 className="admin-h1">サブスク管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>月額メンバーシップ全体ビュー</p>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 26 }}>
        <div className="mm-card" style={{ padding: 18, borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingUp size={14} color="#a855f7" />
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600 }}>MRR (月次経常収益)</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#a855f7' }}>¥{mrr.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>年換算 ¥{(mrr * 12).toLocaleString()}</p>
        </div>
        <div className="mm-card" style={{ padding: 18, borderLeft: '4px solid var(--mm-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Users size={14} color="var(--mm-primary)" />
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600 }}>アクティブ加入</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--mm-primary)' }}>{activeCount}件</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>解約済 {cancelledCount}件</p>
        </div>
        <div className="mm-card" style={{ padding: 18, borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600 }}>Churn Rate</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{churnRate}%</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>累計解約率</p>
        </div>
        <div className="mm-card" style={{ padding: 18, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Gem size={14} color="#f59e0b" />
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600 }}>稼働中プラン</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{plans.filter(p => p.is_active).length}</p>
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>{plans.length} 全プラン</p>
        </div>
      </div>

      {/* プランランキング */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        人気プラン Top 20
      </h2>
      <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>クリエイター</th>
              <th>プラン</th>
              <th className="num">月額</th>
              <th className="num">会員数</th>
              <th className="num">MRR</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {plans.slice(0, 20).map((p, i) => (
              <tr key={p.id}>
                <td data-label="#" className="num" style={{ fontWeight: 700, color: 'var(--mm-text-muted)' }}>{i + 1}</td>
                <td data-label="クリエイター">
                  <Link href={`/creator/${p.creator?.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--mm-ink)' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0 }}>
                      {p.creator?.avatar_url ? <img src={p.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{p.creator?.display_name}</span>
                  </Link>
                </td>
                <td data-label="プラン">
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.badge_color }}>{p.badge_emoji} {p.name}</span>
                </td>
                <td data-label="月額" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>¥{p.monthly_price.toLocaleString()}</td>
                <td data-label="会員数" className="num" style={{ fontWeight: 700, color: 'var(--mm-primary)' }}>{p.member_count}</td>
                <td data-label="MRR" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>¥{(p.monthly_price * p.member_count).toLocaleString()}</td>
                <td data-label="ステータス">
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: p.is_active ? '#d1fae5' : '#fee2e2', color: p.is_active ? '#065f46' : '#991b1b' }}>{p.is_active ? '公開' : '停止'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 最近の加入 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
        最近の加入
      </h2>
      <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12, overflow: 'hidden' }}>
        {recentSubs.map((s, i) => (
          <div key={s.id} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < recentSubs.length - 1 ? '1px solid var(--mm-border)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
              {s.user?.avatar_url ? <img src={s.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-ink)' }}>{s.user?.display_name} <span style={{ color: 'var(--mm-text-muted)' }}>→</span> {s.creator?.display_name}</p>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>{s.plan?.name} · ¥{s.plan?.monthly_price.toLocaleString()}/月 · {new Date(s.started_at).toLocaleDateString('ja-JP')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
