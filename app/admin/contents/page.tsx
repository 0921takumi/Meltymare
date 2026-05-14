import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, XCircle, Clock, Package } from 'lucide-react'
import ModerationButtons from './ModerationButtons'

export const dynamic = 'force-dynamic'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number }> }> = {
  pending:  { label: '審査待ち', color: '#d97706', bg: '#fef3c7', icon: Clock },
  approved: { label: '承認済み', color: '#059669', bg: '#d1fae5', icon: CheckCircle2 },
  rejected: { label: '却下',     color: '#dc2626', bg: '#fee2e2', icon: XCircle },
}

export default async function AdminContentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'pending' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, username, avatar_url)')
    .order('created_at', { ascending: false })

  if (filter !== 'all') {
    query = query.eq('review_status', filter)
  }

  const { data: contents } = await query

  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 }
  const { data: allForCount } = await supabase.from('contents').select('review_status')
  ;(allForCount ?? []).forEach((c: any) => {
    if (c.review_status in counts) counts[c.review_status] += 1
  })

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
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>商品管理・審査</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>投稿されたコンテンツの審査・承認・却下を管理します</p>
      </div>

      {/* SLA Alert Banner */}
      {counts.pending > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="#d97706" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>審査待ちが {counts.pending} 件あります</p>
            <p style={{ fontSize: 11, color: '#9a6a1a', marginTop: 2 }}>投稿から24時間以内の審査が目標SLAです。赤色のアラートが出ているものから優先対応してください。</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const active = filter === t.key
          return (
            <Link key={t.key} href={`/admin/contents?filter=${t.key}`} style={{
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

      {!contents || contents.length === 0 ? (
        <div className="mm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--mm-text-muted)' }}>
          <Package size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ fontSize: 14 }}>該当するコンテンツはありません</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contents.map((c: any) => {
            const status = c.review_status as keyof typeof STATUS_META
            const meta = STATUS_META[status] ?? STATUS_META.pending
            const Icon = meta.icon
            const createdAt = new Date(c.created_at).getTime()
            const ageHours = Math.floor((now - createdAt) / (1000 * 60 * 60))
            const overdue = status === 'pending' && ageHours > 24
            return (
              <div key={c.id} className="mm-card" style={{
                padding: '14px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                border: overdue ? '2px solid #dc2626' : '1px solid var(--mm-border)',
              }}>
                {/* Thumbnail */}
                <div style={{ width: 80, height: 80, borderRadius: 8, background: 'var(--mm-bg)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--mm-text-muted)' }}>
                      <Package size={24} />
                    </div>
                  )}
                  <span style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>
                    {c.content_type === 'video' ? '🎥' : '📸'}
                  </span>
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                      <Icon size={11} />{meta.label}
                    </span>
                    {overdue && (
                      <span style={{ background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                        SLA超過 ({ageHours}h経過)
                      </span>
                    )}
                    {!c.is_published && status === 'approved' && (
                      <span style={{ background: '#6b7280', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                        非公開
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, wordBreak: 'break-word' }}>{c.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>
                    by <Link href={`/creator/${c.creator?.username}`} style={{ color: 'var(--mm-primary)' }}>{c.creator?.display_name}</Link>
                    <span style={{ margin: '0 6px' }}>·</span>
                    ¥{c.price?.toLocaleString()}
                    <span style={{ margin: '0 6px' }}>·</span>
                    投稿 {ageHours < 24 ? `${ageHours}h前` : `${Math.floor(ageHours / 24)}日前`}
                  </p>
                  {Array.isArray(c.tags) && c.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {c.tags.slice(0, 6).map((t: string) => (
                        <span key={t} style={{ fontSize: 10, background: 'var(--mm-bg)', color: 'var(--mm-text-sub)', padding: '1px 7px', borderRadius: 6 }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.description && (
                    <p style={{ fontSize: 11, color: 'var(--mm-text-sub)', lineHeight: 1.5, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {c.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href={`/contents/${c.id}`} target="_blank" style={{ fontSize: 11, color: 'var(--mm-primary)', textDecoration: 'none', fontWeight: 600 }}>
                      プレビューを開く ↗
                    </Link>
                    <ModerationButtons contentId={c.id} currentStatus={status} isPublished={c.is_published} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
