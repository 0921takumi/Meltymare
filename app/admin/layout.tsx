import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/admin/AdminShell'

/**
 * 管理画面 layout（認可ゲート）。
 *
 * このファイルは Server Component で「認可」と「profile の取得」だけを担当。
 * ナビ定義（lucide アイコン＝関数を含む）と UI/モバイルドロワーは Client Component の
 * AdminShell 側に置く。Server→Client へ関数（コンポーネント）を props で渡すと
 * Next.js 16 / React 19 では throw するため、SECTIONS は AdminShell 内に閉じている。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles')
    .select('role, display_name, avatar_url')
    .eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <AdminShell profile={profile}>
      {children}
    </AdminShell>
  )
}
