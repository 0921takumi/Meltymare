import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react'
import ReviewPanel from './ReviewPanel'

export const dynamic = 'force-dynamic'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '審査待ち', color: '#d97706', bg: '#fef3c7' },
  approved: { label: '承認済み', color: '#059669', bg: '#d1fae5' },
  rejected: { label: '却下',     color: '#dc2626', bg: '#fee2e2' },
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'pending' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, role, identity_status, identity_document_url, identity_selfie_url, identity_submitted_at, identity_reviewed_at, identity_rejection_reason, birthdate, created_at')
    .order('identity_submitted_at', { ascending: true, nullsFirst: false })

  if (filter === 'pending') query = query.eq('identity_status', 'pending')
  else if (filter === 'approved') query = query.eq('identity_status', 'approved')
  else if (filter === 'rejected') query = query.eq('identity_status', 'rejected')
  else query = query.in('identity_status', ['pending', 'approved', 'rejected'])

  const { data: profiles } = await query

  const { data: allForCount } = await supabase.from('profiles').select('identity_status').in('identity_status', ['pending', 'approved', 'rejected'])
  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 }
  ;(allForCount ?? []).forEach((p: any) => { if (p.identity_status in counts) counts[p.identity_status] += 1 })

  const now = Date.now()

  const tabs: { key: Filter; label: string; count?: number; color?: string }[] = [
    { key: 'pending',  label: '審査待ち', count: counts.pending,  color: '#d97706' },
    { key: 'approved', label: '承認済み', count: counts.approved, color: '#059669' },
    { key: 'rejected', label: '却下',     count: counts.rejected, color: '#dc2626' },
    { key: 'all',      label: 'すべて' },
  ]

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ShieldCheck size={20} color="var(--mm-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>本人確認審査</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>クリエイターの本人確認書類を審査します（クリエイター規約第3条対応）</p>
      </div>

      {counts.pending > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="#d97706" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>審査待ちが {counts.pending} 件あります</p>
            <p style={{ fontSize: 11, color: '#9a6a1a', marginTop: 2 }}>提出から48時間以内の審査が目標SLAです。古いものから順に対応してください。</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const active = filter === t.key
          return (
            <Link key={t.key} href={`/admin/verifications?filter=${t.key}`} style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
              textDecoration: 'none',
              background: active ? (t.color ?? 'var(--mm-primary)') : 'white',
              color: active ? 'white' : 'var(--mm-text)',
              border: `1px solid ${active ? 'transparent' : 'var(--mm-border)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {typeof t.count === 'number' && (
                <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'var(--mm-bg)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>
                  {t.count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {!profiles || profiles.length === 0 ? (
        <div className="mm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--mm-text-muted)' }}>
          <ShieldCheck size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ fontSize: 14 }}>該当する申請はありません</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map((p: any) => {
            const status = p.identity_status as keyof typeof STATUS_META
            const meta = STATUS_META[status] ?? STATUS_META.pending
            const submittedAt = p.identity_submitted_at ? new Date(p.identity_submitted_at).getTime() : 0
            const ageHours = submittedAt ? Math.floor((now - submittedAt) / (1000 * 60 * 60)) : 0
            const overdue = status === 'pending' && ageHours > 48
            const birthdate = p.birthdate ? new Date(p.birthdate) : null
            let age: number | null = null
            if (birthdate) {
              age = new Date().getFullYear() - birthdate.getFullYear()
              const m = new Date().getMonth() - birthdate.getMonth()
              if (m < 0 || (m === 0 && new Date().getDate() < birthdate.getDate())) age--
            }
            return (
              <div key={p.id} className="mm-card" style={{
                padding: '14px 16px',
                border: overdue ? '2px solid #dc2626' : '1px solid var(--mm-border)',
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--mm-bg)', overflow: 'hidden', flexShrink: 0 }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mm-text-muted)' }}>?</div>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                        {meta.label}
                      </span>
                      {overdue && (
                        <span style={{ background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                          SLA超過 ({ageHours}h経過)
                        </span>
                      )}
                      {age !== null && age < 18 && (
                        <span style={{ background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                          ⚠️ 18歳未満
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{p.display_name ?? p.username ?? '(名前未設定)'}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>
                      @{p.username ?? '—'}
                      <span style={{ margin: '0 6px' }}>·</span>
                      role: {p.role}
                      {age !== null && (
                        <>
                          <span style={{ margin: '0 6px' }}>·</span>
                          {age}歳（{p.birthdate}）
                        </>
                      )}
                    </p>
                    {submittedAt > 0 && (
                      <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                        提出: {new Date(p.identity_submitted_at).toLocaleString('ja-JP')}
                        {p.identity_reviewed_at && (
                          <>
                            <span style={{ margin: '0 6px' }}>·</span>
                            審査済: {new Date(p.identity_reviewed_at).toLocaleString('ja-JP')}
                          </>
                        )}
                      </p>
                    )}
                    {status === 'rejected' && p.identity_rejection_reason && (
                      <p style={{ fontSize: 11, color: '#991b1b', marginTop: 4, padding: 6, background: '#fef2f2', borderRadius: 4 }}>
                        却下理由: {p.identity_rejection_reason}
                      </p>
                    )}
                  </div>
                </div>

                {(status === 'pending' || status === 'rejected') && (
                  <ReviewPanel
                    userId={p.id}
                    idPath={p.identity_document_url}
                    selfiePath={p.identity_selfie_url}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
