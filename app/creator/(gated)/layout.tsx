import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * クリエイター専用ページ（ダッシュボード/出品/注文/クーポン等）の認可ゲート。
 *
 * これまで proxy.ts が毎リクエスト DB(RPC) でロールを再チェックしていたが、
 * Next.js 16 公式ガイド（node_modules/next/dist/docs/01-app/02-guides/authentication.md）は
 * 「Proxy は prefetch でも毎回走るため、DB を伴う secure check は Proxy に置かず、
 * ページに近い Data Access Layer で行うべき」としている。ここが admin/layout.tsx と
 * 同じ役割を creator 側に持たせる DAL。role の再チェックは以後ここが正とし、
 * proxy.ts 側の重複チェックは撤去した（is_suspended/deleted_at のグローバルチェックのみ
 * proxy.ts に残す）。
 */
export default async function CreatorGatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles')
    .select('role')
    .eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/contents')

  return <>{children}</>
}
