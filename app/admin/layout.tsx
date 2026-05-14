import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, ShoppingBag, TrendingUp, Wallet, Package,
  MessageSquare, Image as ImageIcon, ShieldCheck, Radio, Sparkles, Gem, Gavel,
  Flag, BarChart3, FileText,
} from 'lucide-react'

interface NavItem { href: string; icon: React.ComponentType<{ size?: number }>; label: string }
interface NavSection { title: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { href: '/admin',           icon: LayoutDashboard, label: 'ダッシュボード' },
      { href: '/admin/analytics', icon: BarChart3,       label: '分析・KPI' },
      { href: '/admin/audit',     icon: FileText,        label: '操作ログ' },
    ],
  },
  {
    title: 'USERS',
    items: [
      { href: '/admin/users',         icon: Users,        label: 'ユーザー管理' },
      { href: '/admin/creators',      icon: Package,      label: 'クリエイター' },
      { href: '/admin/verifications', icon: ShieldCheck,  label: '本人確認審査' },
    ],
  },
  {
    title: 'CONTENT',
    items: [
      { href: '/admin/contents',  icon: Package,    label: '商品管理・審査' },
      { href: '/admin/lives',     icon: Radio,      label: 'ライブ配信' },
      { href: '/admin/stories',   icon: Sparkles,   label: 'ストーリー' },
      { href: '/admin/comments',  icon: Flag,       label: 'コメント・通報' },
    ],
  },
  {
    title: 'BUSINESS',
    items: [
      { href: '/admin/orders',        icon: ShoppingBag, label: '注文管理' },
      { href: '/admin/sales',         icon: TrendingUp,  label: '売上管理' },
      { href: '/admin/payouts',       icon: Wallet,      label: '振込管理' },
      { href: '/admin/subscriptions', icon: Gem,         label: 'サブスク管理' },
      { href: '/admin/auctions',      icon: Gavel,       label: 'オークション' },
    ],
  },
  {
    title: 'OPERATION',
    items: [
      { href: '/admin/banners',   icon: ImageIcon,     label: '特集バナー' },
      { href: '/admin/invites',   icon: ShieldCheck,   label: '招待コード' },
      { href: '/admin/inquiries', icon: MessageSquare, label: '問い合わせ' },
    ],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role, display_name, avatar_url').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <aside style={{
        width: 230, flexShrink: 0,
        background: '#1f1a15',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 100, overflowY: 'auto',
      }} className="mm-admin-sidebar">
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: 'white', letterSpacing: '0.05em' }}>
              My Focus
            </span>
          </Link>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, letterSpacing: '0.1em' }}>
            STAFF CONSOLE
          </div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 4 }}>
              <p style={{ padding: '10px 20px 4px', fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.12em' }}>{section.title}</p>
              {section.items.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 20px', fontSize: 12.5, color: 'rgba(255,255,255,0.78)',
                  textDecoration: 'none',
                }}>
                  <Icon size={14} />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', flexShrink: 0 }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, color: 'white', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.display_name ?? 'Admin'}</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Staff Only</p>
          </div>
        </div>
      </aside>

      <main className="mm-admin-main" style={{ marginLeft: 230, flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
