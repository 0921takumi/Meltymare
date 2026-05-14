import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminShell, { type NavSection } from '@/components/admin/AdminShell'
import {
  LayoutDashboard, Users, ShoppingBag, TrendingUp, Wallet, Package,
  MessageSquare, Image as ImageIcon, ShieldCheck, Radio, Sparkles, Gem, Gavel,
  Flag, BarChart3, FileText,
} from 'lucide-react'

/**
 * 管理画面 layout（認可ゲート + シェル組み立て）
 *
 * このファイルは Server Component で認可だけ担当。
 * UI/モバイルドロワーは AdminShell に切り出して Client Component に。
 */

const SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin',           icon: LayoutDashboard, label: 'ダッシュボード' },
      { href: '/admin/analytics', icon: BarChart3,       label: '分析・KPI' },
      { href: '/admin/audit',     icon: FileText,        label: '操作ログ' },
    ],
  },
  {
    title: 'Users',
    items: [
      { href: '/admin/users',         icon: Users,        label: 'ユーザー管理' },
      { href: '/admin/creators',      icon: Package,      label: 'クリエイター' },
      { href: '/admin/verifications', icon: ShieldCheck,  label: '本人確認審査' },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/contents',  icon: Package,    label: '商品管理・審査' },
      { href: '/admin/lives',     icon: Radio,      label: 'ライブ配信' },
      { href: '/admin/stories',   icon: Sparkles,   label: 'ストーリー' },
      { href: '/admin/comments',  icon: Flag,       label: 'コメント・通報' },
    ],
  },
  {
    title: 'Business',
    items: [
      { href: '/admin/orders',        icon: ShoppingBag, label: '注文管理' },
      { href: '/admin/sales',         icon: TrendingUp,  label: '売上管理' },
      { href: '/admin/payouts',       icon: Wallet,      label: '振込管理' },
      { href: '/admin/subscriptions', icon: Gem,         label: 'サブスク管理' },
      { href: '/admin/auctions',      icon: Gavel,       label: 'オークション' },
    ],
  },
  {
    title: 'Operation',
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

  const { data: profile } = await supabase.from('profiles')
    .select('role, display_name, avatar_url')
    .eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <AdminShell sections={SECTIONS} profile={profile}>
      {children}
    </AdminShell>
  )
}
