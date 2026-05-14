import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  action_type: string
  target_type: string
  target_id: string | null
  detail: Record<string, unknown> | null
  created_at: string
  admin: { display_name: string; avatar_url: string | null } | null
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_suspend:        { label: 'ユーザー凍結',      color: '#dc2626' },
  user_unsuspend:      { label: '凍結解除',          color: '#059669' },
  role_change:         { label: 'ロール変更',        color: '#7c3aed' },
  inquiry_update:      { label: '問い合わせ更新',    color: '#2563eb' },
  story_delete:        { label: 'ストーリー削除',    color: '#dc2626' },
  live_force_stop:     { label: 'ライブ強制停止',    color: '#dc2626' },
  comment_report_hide: { label: 'コメント非表示化',  color: '#dc2626' },
  comment_report_dismiss:{ label: '通報却下',         color: '#6b7280' },
  comment_report_resolve:{ label: '通報対応済',       color: '#059669' },
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const type = sp.type ?? 'all'

  let query = supabase
    .from('admin_actions')
    .select('id, action_type, target_type, target_id, detail, created_at, admin:profiles!admin_actions_admin_id_fkey(display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (type !== 'all') query = query.eq('action_type', type)

  const { data } = await query
  const rows = (data ?? []) as unknown as AuditRow[]

  return (
    <div style={{ padding: '32px 32px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>操作ログ</h1>
      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 22 }}>管理者の操作履歴（最新200件）</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link href="/admin/audit?type=all" style={tabStyle(type === 'all')}>すべて</Link>
        {Object.entries(ACTION_LABELS).map(([k, v]) => (
          <Link key={k} href={`/admin/audit?type=${k}`} style={tabStyle(type === k)}>{v.label}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
          <FileText size={36} />
          <p style={{ fontSize: 13, marginTop: 8 }}>操作履歴がありません</p>
        </div>
      ) : (
        <div className="mm-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--mm-bg)' }}>
                {['日時', '管理者', '操作', '対象', '詳細'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cfg = ACTION_LABELS[r.action_type] ?? { label: r.action_type, color: 'var(--mm-text-sub)' }
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--mm-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden' }}>
                          {r.admin?.avatar_url ? <img src={r.admin.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{r.admin?.display_name ?? '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: cfg.color, border: `1px solid ${cfg.color}30`, background: `${cfg.color}10` }}>{cfg.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--mm-text-sub)' }}>{r.target_type}{r.target_id && <span style={{ marginLeft: 6, color: 'var(--mm-text-muted)', fontSize: 10 }}>{r.target_id.slice(0, 8)}...</span>}</td>
                    <td style={{ padding: '10px 14px', fontSize: 10, color: 'var(--mm-text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {r.detail ? JSON.stringify(r.detail) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: active ? 'var(--mm-primary)' : 'white',
    color: active ? 'white' : 'var(--mm-text-sub)',
    border: active ? 'none' : '1px solid var(--mm-border)',
    textDecoration: 'none',
  }
}
