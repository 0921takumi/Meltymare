import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import BannerManager from './BannerManager'

export default async function AdminBannersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/mypage')

  const { data: banners } = await supabase
    .from('featured_banners')
    .select('*, creator:profiles(id, display_name, username), content:contents(id, title)')
    .order('sort_order', { ascending: true })

  // クリエイター一覧 (選択用)
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, display_name, username')
    .eq('role', 'creator')
    .order('display_name')

  // コンテンツ一覧 (選択用, 最新50)
  const { data: contents } = await supabase
    .from('contents')
    .select('id, title')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>特集バナー管理</h1>
        <BannerManager
          initialBanners={(banners ?? []) as any}
          creators={creators ?? []}
          contents={contents ?? []}
        />
      </div>
    </div>
  )
}
