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

  const { data: counts } = await supabase.from('contact_messages').select('status')
  const countBy = (s: string) => counts?.filter((m: any) => m.status === s).length ?? 0

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>問い合わせ管理</h1>
      <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 20 }}>
        全 {counts?.length ?? 0} 件 · 未対応 {countBy('new')} · 対応中 {countBy('in_progress')} · 解決 {countBy('resolved')}
      </p>
      <InquiriesList messages={messages ?? []} currentStatus={status} />
    </div>
  )
}
