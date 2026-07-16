import { createClient } from '@/lib/supabase/server'
import InquiriesList from './InquiriesList'

export const dynamic = 'force-dynamic'

export default async function AdminInquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const status = params.status ?? 'all'

  const supabase = await createClient()

  let q = supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
  if (status !== 'all') q = q.eq('status', status)

  const { data: messages } = await q.limit(200)

  // ヘッダの件数集計。Supabase デフォルト1000行上限での過少カウントを緩和。
  // 規模拡大時は status 別の count クエリ（head:true）に切り替えること。
  const { data: counts } = await supabase.from('contact_messages').select('status').limit(10000)
  const countBy = (s: string) => counts?.filter((m: { status: string }) => m.status === s).length ?? 0

  return (
    <div className="admin-page">
      <h1 className="admin-h1">問い合わせ管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 20 }}>
        全 {counts?.length ?? 0} 件 · 未対応 {countBy('open')} · 対応中 {countBy('in_progress')} · 解決 {countBy('resolved')}
      </p>
      <InquiriesList messages={messages ?? []} currentStatus={status} />
    </div>
  )
}
