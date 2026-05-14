import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CommentReportRow from './CommentReportRow'
import { Flag } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ReportRow {
  id: string
  reason: string
  detail: string | null
  status: string
  created_at: string
  comment: {
    id: string
    body: string
    is_hidden: boolean
    content_id: string
    user: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  } | null
  reporter: { id: string; display_name: string; username: string } | null
}

const REASON_LABELS: Record<string, string> = {
  spam: 'スパム',
  harassment: 'ハラスメント',
  inappropriate: '不適切',
  copyright: '著作権侵害',
  other: 'その他',
}

export default async function AdminCommentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const status = sp.status ?? 'pending'

  let query = supabase
    .from('comment_reports')
    .select(`
      id, reason, detail, status, created_at,
      comment:content_comments(id, body, is_hidden, content_id, user:profiles!content_comments_user_id_fkey(id, display_name, username, avatar_url)),
      reporter:profiles!comment_reports_reporter_id_fkey(id, display_name, username)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') query = query.eq('status', status)

  const { data } = await query
  const reports = (data ?? []) as unknown as ReportRow[]

  const counts = { pending: 0, reviewing: 0, resolved: 0, dismissed: 0, all: 0 }
  const { data: all } = await supabase.from('comment_reports').select('status')
  for (const r of all ?? []) {
    counts.all++
    if (r.status in counts) counts[r.status as keyof typeof counts]++
  }

  return (
    <div style={{ padding: '32px 32px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>コメント管理 / 通報対応</h1>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 4 }}>ユーザーから通報されたコメントの審査</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'pending', label: '未対応', count: counts.pending },
          { key: 'reviewing', label: '審査中', count: counts.reviewing },
          { key: 'resolved', label: '対応済', count: counts.resolved },
          { key: 'dismissed', label: '却下', count: counts.dismissed },
          { key: 'all', label: 'すべて', count: counts.all },
        ].map(t => (
          <Link key={t.key} href={`/admin/comments?status=${t.key}`} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: status === t.key ? 'var(--mm-primary)' : 'white',
            color: status === t.key ? 'white' : 'var(--mm-text-sub)',
            border: status === t.key ? 'none' : '1px solid var(--mm-border)',
            textDecoration: 'none',
          }}>{t.label} <span style={{ marginLeft: 4, opacity: 0.7 }}>({t.count})</span></Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
          <Flag size={36} />
          <p style={{ fontSize: 13, marginTop: 8 }}>該当する通報がありません</p>
        </div>
      ) : (
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          {reports.map((r, i) => (
            <CommentReportRow key={r.id} report={r} reasonLabel={REASON_LABELS[r.reason] ?? r.reason} isLast={i === reports.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}
