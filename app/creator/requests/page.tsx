import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import RequestReplyForm from './RequestReplyForm'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '返信待ち', color: '#d97706', bg: '#fffbeb' },
  accepted:  { label: '承認済み', color: '#2563eb', bg: '#eff6ff' },
  rejected:  { label: '見送り',   color: '#dc2626', bg: '#fef2f2' },
  completed: { label: '完了',     color: '#059669', bg: '#f0fdf4' },
}

export default async function CreatorRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'creator') redirect('/mypage')

  const { data: requests } = await supabase
    .from('requests')
    .select('*, user:profiles!requests_user_id_fkey(id, display_name, avatar_url)')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  const pendingCount = requests?.filter(r => r.status === 'pending').length ?? 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>
            リクエスト管理
            {pendingCount > 0 && (
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 700, background: '#d97706', color: 'white', padding: '2px 10px', borderRadius: 20 }}>
                {pendingCount}件 返信待ち
              </span>
            )}
          </h1>
        </div>

        {!requests || requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📮</p>
            <p style={{ fontSize: 15 }}>まだリクエストはありません</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {requests.map((r: any) => {
              const s = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
              return (
                <div key={r.id} className="mm-card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {r.user?.avatar_url ? <img src={r.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700 }}>{r.user?.display_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </div>

                  <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.6, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{r.message}</p>
                  {r.budget && <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>希望予算: ¥{r.budget.toLocaleString()}</p>}

                  {r.creator_reply && (
                    <div style={{ padding: '10px 14px', background: 'var(--mm-primary-light)', borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 700, marginBottom: 4 }}>あなたの返信</p>
                      <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.creator_reply}</p>
                    </div>
                  )}

                  {/* 返信フォーム (pending のみ) */}
                  {r.status === 'pending' && (
                    <RequestReplyForm requestId={r.id} />
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
