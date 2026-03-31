import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '返信待ち', color: '#d97706', bg: '#fffbeb' },
  accepted:  { label: '承認済み', color: '#2563eb', bg: '#eff6ff' },
  rejected:  { label: '見送り',   color: '#dc2626', bg: '#fef2f2' },
  completed: { label: '完了',     color: '#059669', bg: '#f0fdf4' },
}

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: requests } = await supabase
    .from('requests')
    .select('*, creator:profiles!requests_creator_id_fkey(id, display_name, username, avatar_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>リクエスト一覧</h1>

        {!requests || requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📮</p>
            <p style={{ fontSize: 15, marginBottom: 16 }}>まだリクエストはありません</p>
            <Link href="/creators" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600, textDecoration: 'none' }}>
              クリエイターを探す →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((r: any) => {
              const s = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
              return (
                <div key={r.id} className="mm-card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {r.creator?.avatar_url ? <img src={r.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700 }}>{r.creator?.display_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </div>

                  <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.6, marginBottom: r.creator_reply ? 12 : 0, whiteSpace: 'pre-wrap' }}>
                    {r.message}
                  </p>

                  {r.budget && (
                    <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 6 }}>希望予算: ¥{r.budget.toLocaleString()}</p>
                  )}

                  {r.creator_reply && (
                    <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--mm-primary-light)', borderRadius: 8, borderLeft: '3px solid var(--mm-primary)' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-primary)', marginBottom: 4 }}>{r.creator?.display_name} より返信</p>
                      <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.creator_reply}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
