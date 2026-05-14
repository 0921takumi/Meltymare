import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  TrendingUp, Users, ShoppingBag, Wallet, Package, MessageSquare, AlertTriangle,
  ShieldCheck, Radio, Sparkles, Gem, Gavel, Cake, ArrowRight, Activity,
  Flag, Bell,
} from 'lucide-react'
import { FINANCE } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: totalCreators },
    { data: allPurchases },
    { data: monthPurchases },
    { data: dailyPurchases },
    { count: totalContents },
    { count: pendingContents },
    { count: pendingVerifications },
    { count: openInquiries },
    { count: urgentInquiries },
    { count: pendingReports },
    { count: liveStreams },
    { count: openAuctions },
    { count: activeSubscriptions },
    { count: storiesCount },
    { data: recentPurchases },
    { data: recentSignups },
    { data: pendingPayouts },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
    supabase.from('purchases').select('amount, tip_amount, created_at').eq('status', 'completed'),
    supabase.from('purchases').select('amount, tip_amount').eq('status', 'completed').gte('created_at', startOfMonth),
    supabase.from('purchases').select('amount, tip_amount, created_at').eq('status', 'completed').gte('created_at', last30),
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('is_published', false),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('identity_status', 'pending'),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'urgent'),
    supabase.from('comment_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('live_streams').select('*', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('request_auctions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('stories').select('*', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString()),
    supabase.from('purchases')
      .select('id, amount, created_at, content:contents(title, price), user:profiles!purchases_user_id_fkey(display_name, email, avatar_url)')
      .eq('status', 'completed').order('created_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('id, display_name, email, role, avatar_url, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('purchases').select('amount, tip_amount').eq('status', 'completed').is('payout_id', null),
  ])

  const totalSales = (allPurchases ?? []).reduce((s, p) => s + (p.amount ?? 0) + (p.tip_amount ?? 0), 0)
  const totalOrders = allPurchases?.length ?? 0
  const monthSales = (monthPurchases ?? []).reduce((s, p) => s + (p.amount ?? 0) + (p.tip_amount ?? 0), 0)
  const monthOrders = monthPurchases?.length ?? 0
  const aov = monthOrders > 0 ? Math.round(monthSales / monthOrders) : 0
  const last7Sales = (dailyPurchases ?? []).filter(p => p.created_at >= last7).reduce((s, p) => s + (p.amount ?? 0) + (p.tip_amount ?? 0), 0)
  const last24hOrders = (dailyPurchases ?? []).filter(p => p.created_at >= last24h).length

  // 過去30日のデイリー売上 (グラフ用)
  const days: { key: string; label: string; amount: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, amount: 0 })
  }
  for (const p of dailyPurchases ?? []) {
    const k = p.created_at.slice(0, 10)
    const d = days.find(x => x.key === k)
    if (d) d.amount += (p.amount ?? 0) + (p.tip_amount ?? 0)
  }
  const maxDaily = Math.max(1, ...days.map(d => d.amount))

  const pendingPayoutAmount = (pendingPayouts ?? []).reduce((s, p) => s + (p.amount ?? 0) + (p.tip_amount ?? 0), 0)
  const platformShare = Math.round(pendingPayoutAmount * FINANCE.defaultFeeRate / 100)
  const creatorShare = pendingPayoutAmount - platformShare

  // アラート
  const alerts: { kind: 'urgent' | 'warn' | 'info'; label: string; count?: number; href: string }[] = []
  if ((urgentInquiries ?? 0) > 0) alerts.push({ kind: 'urgent', label: '緊急問い合わせ', count: urgentInquiries ?? 0, href: '/admin/inquiries?priority=urgent' })
  if ((pendingVerifications ?? 0) > 0) alerts.push({ kind: 'warn', label: '本人確認待ち', count: pendingVerifications ?? 0, href: '/admin/verifications' })
  if ((pendingContents ?? 0) > 0) alerts.push({ kind: 'warn', label: '商品審査待ち', count: pendingContents ?? 0, href: '/admin/contents' })
  if ((pendingReports ?? 0) > 0) alerts.push({ kind: 'warn', label: 'コメント通報', count: pendingReports ?? 0, href: '/admin/comments' })
  if ((openInquiries ?? 0) > 0) alerts.push({ kind: 'info', label: '未対応問い合わせ', count: openInquiries ?? 0, href: '/admin/inquiries' })

  return (
    <div className="admin-page">
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
          Dashboard
        </p>
        <h1 className="admin-h1">ダッシュボード</h1>
        <p className="admin-h1-sub">
          {today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · My Focus 運営管理コンソール
        </p>
      </div>

      {/* アラートバー */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {alerts.map(a => {
            const palette = a.kind === 'urgent'
              ? { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
              : a.kind === 'warn'
              ? { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
              : { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' }
            return (
              <Link key={a.label} href={a.href} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: palette.bg, color: palette.color,
                border: `1px solid ${palette.border}`, borderRadius: 999, fontSize: 12, fontWeight: 700,
                textDecoration: 'none',
              }}>
                {a.kind === 'urgent' ? <AlertTriangle size={13} /> : <Bell size={13} />}
                {a.label}
                {a.count !== undefined && (
                  <span style={{ background: 'white', color: palette.color, padding: '1px 8px', borderRadius: 999, fontSize: 11 }}>{a.count}</span>
                )}
                <ArrowRight size={12} />
              </Link>
            )
          })}
        </div>
      )}

      {/* メインKPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard icon={TrendingUp} label="今月の売上" value={`¥${monthSales.toLocaleString()}`} sub={`${monthOrders}件 / 直近7日 ¥${last7Sales.toLocaleString()}`} color="#059669" bg="#d1fae5" />
        <KpiCard icon={ShoppingBag} label="累計注文" value={`${totalOrders}件`} sub={`累計 ¥${totalSales.toLocaleString()} / AOV ¥${aov.toLocaleString()}`} color="var(--mm-primary)" bg="var(--mm-primary-light)" />
        <KpiCard icon={Activity} label="直近24h注文" value={`${last24hOrders}件`} sub="リアルタイム取引" color="#dc2626" bg="#fee2e2" />
        <KpiCard icon={Wallet} label="未払振込" value={`¥${creatorShare.toLocaleString()}`} sub={`手数料 ¥${platformShare.toLocaleString()}`} color="#7c3aed" bg="#ede9fe" />
      </div>

      {/* セカンダリKPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        <MiniKpi icon={Users} label="会員" value={`${totalUsers ?? 0}`} href="/admin/users" />
        <MiniKpi icon={Package} label="クリエイター" value={`${totalCreators ?? 0}`} href="/admin/creators" />
        <MiniKpi icon={ShieldCheck} label="本人確認待ち" value={`${pendingVerifications ?? 0}`} href="/admin/verifications" warn={(pendingVerifications ?? 0) > 0} />
        <MiniKpi icon={Package} label="公開コンテンツ" value={`${totalContents ?? 0}`} href="/admin/contents" />
        <MiniKpi icon={Radio} label="ライブ配信中" value={`${liveStreams ?? 0}`} href="/admin/lives" highlight={(liveStreams ?? 0) > 0} />
        <MiniKpi icon={Gavel} label="受付中オークション" value={`${openAuctions ?? 0}`} href="/admin/auctions" />
        <MiniKpi icon={Gem} label="サブスク加入" value={`${activeSubscriptions ?? 0}`} href="/admin/subscriptions" />
        <MiniKpi icon={Sparkles} label="公開ストーリー" value={`${storiesCount ?? 0}`} href="/admin/stories" />
        <MiniKpi icon={Flag} label="通報" value={`${pendingReports ?? 0}`} href="/admin/comments" warn={(pendingReports ?? 0) > 0} />
        <MiniKpi icon={MessageSquare} label="未対応問合せ" value={`${openInquiries ?? 0}`} href="/admin/inquiries" warn={(openInquiries ?? 0) > 0} />
      </div>

      {/* グラフ + アクティビティ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginBottom: 24 }} className="dash-row">
        {/* 売上グラフ */}
        <div className="mm-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>📈 過去30日の日次売上</h3>
            <Link href="/admin/analytics" style={{ fontSize: 11, color: 'var(--mm-primary)', fontWeight: 700, textDecoration: 'none' }}>詳細分析 →</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, paddingBottom: 8, borderBottom: '1px solid var(--mm-border)' }}>
            {days.map(d => (
              <div key={d.key} style={{ flex: 1, height: `${(d.amount / maxDaily) * 100}%`, background: d.amount > 0 ? 'linear-gradient(180deg, var(--mm-primary) 0%, var(--mm-accent) 100%)' : 'transparent', borderRadius: '3px 3px 0 0', minHeight: d.amount > 0 ? 4 : 0 }}
                title={`${d.label}: ¥${d.amount.toLocaleString()}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {days.map((d, i) => (
              <div key={d.key} style={{ flex: 1, fontSize: 9, color: 'var(--mm-text-muted)', textAlign: 'center', visibility: i % 5 === 0 ? 'visible' : 'hidden' }}>{d.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 2カラム: 最近の注文 + 新規ユーザー（モバイル: 1col） */}
      <div className="dash-2col" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginBottom: 24 }}>
        {/* 最近の購入 */}
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mm-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>最近の購入</p>
            <Link href="/admin/orders" style={{ fontSize: 11, color: 'var(--mm-primary)', fontWeight: 700, textDecoration: 'none' }}>すべて →</Link>
          </div>
          {!recentPurchases || recentPurchases.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13 }}>注文データなし</div>
          ) : (
            <div>
              {recentPurchases.map((p) => {
                const buyer = (p as { user: { display_name?: string; email?: string; avatar_url?: string | null } | null }).user
                const content = (p as { content: { title?: string } | null }).content
                return (
                  <div key={p.id} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--mm-border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                      {buyer?.avatar_url ? <img src={buyer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buyer?.display_name ?? '—'}</p>
                      <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content?.title ?? '—'}</p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>¥{p.amount.toLocaleString()}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 新規ユーザー */}
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mm-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>新規登録</p>
            <Link href="/admin/users" style={{ fontSize: 11, color: 'var(--mm-primary)', fontWeight: 700, textDecoration: 'none' }}>すべて →</Link>
          </div>
          {recentSignups?.map(u => (
            <div key={u.id} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--mm-border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</p>
                <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>
                  <span style={{ padding: '1px 6px', borderRadius: 999, background: u.role === 'creator' ? '#ede9fe' : '#dbeafe', color: u.role === 'creator' ? '#7c3aed' : '#1e40af', marginRight: 6 }}>{u.role === 'creator' ? 'Creator' : u.role === 'admin' ? 'Admin' : 'User'}</span>
                  {new Date(u.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 1100px) {
          .dash-2col { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color, bg }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; sub?: string; color: string; bg: string }) {
  return (
    <div className="mm-card" style={{ padding: 18, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function MiniKpi({ icon: Icon, label, value, href, warn, highlight }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; href: string; warn?: boolean; highlight?: boolean }) {
  return (
    <Link href={href} className="mm-card" style={{
      padding: 14, textDecoration: 'none', display: 'block',
      borderTop: warn ? '3px solid #f59e0b' : highlight ? '3px solid #dc2626' : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Icon size={14} color={warn ? '#f59e0b' : highlight ? '#dc2626' : 'var(--mm-text-muted)'} />
        <ArrowRight size={11} color="var(--mm-text-muted)" />
      </div>
      <p style={{ fontSize: 18, fontWeight: 700, color: warn ? '#f59e0b' : highlight ? '#dc2626' : 'var(--mm-text)' }}>{value}</p>
      <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>{label}</p>
    </Link>
  )
}
