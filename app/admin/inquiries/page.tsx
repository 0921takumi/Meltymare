import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import InquiryRow from './InquiryRow'

export const dynamic = 'force-dynamic'

interface Inquiry {
  id: string
  name: string
  email: string
  subject: string
  body: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  user: { display_name: string; avatar_url: string | null } | null
}

const STATUS_LABELS = { open: '未対応', in_progress: '対応中', resolved: '解決済', closed: 'クローズ' }
const PRIORITY_COLORS = {
  urgent: { bg: '#fee2e2', color: '#991b1b' },
  high:   { bg: '#fed7aa', color: '#9a3412' },
  normal: { bg: '#dbeafe', color: '#1e40af' },
  low:    { bg: '#f3f4f6', color: '#6b7280' },
}

export default async function AdminInquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; priority?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const status = sp.status ?? 'open'
  const priority = sp.priority ?? 'all'

  let query = supabase
    .from('inquiries')
    .select('*, user:profiles(display_name, avatar_url)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)
  if (priority !== 'all') query = query.eq('priority', priority)

  const { data } = await query
  const inquiries = (data ?? []) as unknown as Inquiry[]

  const counts = {
    open: 0, in_progress: 0, resolved: 0, closed: 0, all: 0,
    urgent: 0, high: 0,
  }
  const { data: allInquiries } = await supabase.from('inquiries').select('status, priority')
  for (const i of allInquiries ?? []) {
    counts.all++
    if (i.status in counts) counts[i.status as keyof typeof counts]++
    if (i.priority === 'urgent') counts.urgent++
    if (i.priority === 'high') counts.high++
  }

  return (
    <div style={{ padding: '32px 32px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>問い合わせ管理</h1>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 4 }}>ユーザーからの問い合わせとサポートチケット</p>
      </div>

      {/* ステータスタブ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { key: 'open', label: '未対応', count: counts.open },
          { key: 'in_progress', label: '対応中', count: counts.in_progress },
          { key: 'resolved', label: '解決済', count: counts.resolved },
          { key: 'closed', label: 'クローズ', count: counts.closed },
          { key: 'all', label: 'すべて', count: counts.all },
        ].map(t => (
          <Link key={t.key} href={`/admin/inquiries?status=${t.key}${priority !== 'all' ? `&priority=${priority}` : ''}`} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: status === t.key ? 'var(--mm-primary)' : 'white',
            color: status === t.key ? 'white' : 'var(--mm-text-sub)',
            border: status === t.key ? 'none' : '1px solid var(--mm-border)',
            textDecoration: 'none',
          }}>{t.label} <span style={{ marginLeft: 6, opacity: 0.7 }}>({t.count})</span></Link>
        ))}
      </div>

      {/* 優先度フィルタ */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 700 }}>優先度:</span>
        {[
          { key: 'all', label: 'すべて' },
          { key: 'urgent', label: '緊急', count: counts.urgent, color: '#dc2626' },
          { key: 'high', label: '高', count: counts.high, color: '#ea580c' },
          { key: 'normal', label: '通常', color: '#2563eb' },
          { key: 'low', label: '低', color: '#6b7280' },
        ].map(p => (
          <Link key={p.key} href={`/admin/inquiries?status=${status}&priority=${p.key}`} style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: priority === p.key ? (p.color ?? 'var(--mm-text-sub)') : 'transparent',
            color: priority === p.key ? 'white' : 'var(--mm-text-sub)',
            border: '1px solid var(--mm-border)', textDecoration: 'none',
          }}>{p.label}{p.count !== undefined && ` ${p.count}`}</Link>
        ))}
      </div>

      <div className="mm-card" style={{ overflow: 'hidden' }}>
        {inquiries.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 13 }}>該当する問い合わせがありません</div>
        ) : (
          <div>
            {inquiries.map((i, idx) => (
              <InquiryRow key={i.id} inquiry={i} statusLabel={STATUS_LABELS[i.status]} priorityPalette={PRIORITY_COLORS[i.priority]} isLast={idx === inquiries.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
