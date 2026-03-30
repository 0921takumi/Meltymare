import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, ShoppingBag, TrendingUp, Wallet, Package, MessageSquare } from 'lucide-react'

const NAV = [
  { href: '/admin',          icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/admin/creators', icon: Users,            label: 'クリエイター管理' },
  { href: '/admin/contents', icon: Package,          label: '商品管理・審査' },
  { href: '/admin/sales',    icon: TrendingUp,       label: '売上管理' },
  { href: '/admin/payouts',  icon: Wallet,           label: '振込管理' },
  { href: '/admin/orders',   icon: ShoppingBag,      label: '注文管理' },
  { href: '/admin/inquiries',icon: MessageSquare,    label: '問い合わせ' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--mm-bg)' }}>
      {/* サイドバー */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#1a2f4a',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 100,
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: 'white', letterSpacing: '0.05em' }}>
              Meltymare
            </span>
          </Link>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, letterSpacing: '0.1em' }}>
            STAFF CONSOLE
          </div>
        </div>

        <nav style={{ padding: '12px 0', flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', fontSize: 13, color: 'rgba(255,255,255,0.75)',
              textDecoration: 'none',
            }}>
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          Staff Only
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
