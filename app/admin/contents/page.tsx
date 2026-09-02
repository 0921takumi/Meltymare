import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, XCircle, Clock, Package } from 'lucide-react'
import ModerationButtons from './ModerationButtons'

export const dynamic = 'force-dynamic'

type Filter = 'pending' | 'approved' | 'rejected' | 'takedown' | 'all'

const PAGE_LIMIT = 200

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number }> }> = {
  pending:  { label: '新着・未確認', color: '#d97706', bg: '#fef3c7', icon: Clock },
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

  // 未確認(pending)は古いものほど危険なので昇順（滞留した順）で出す。
  // それ以外のタブは従来どおり新しい順。
  const oldestFirst = filter === 'pending'
  let query = supabase
    .from('contents')
    .select('*, creator:profiles!contents_creator_id_fkey(id, display_name, username, avatar_url)')
    .order('created_at', { ascending: oldestFirst })
    .limit(PAGE_LIMIT)

  // 納品前監査で発覚: 配信停止(takedown)は review_status='rejected' も立てるため「却下」タブに
  // 紛れ、通常の却下と区別できなかった。専用タブを設ける。
  if (filter === 'takedown') {
    query = query.eq('hard_takedown', true)
  } else if (filter !== 'all') {
    query = query.eq('review_status', filter)
  }

  const { data: contents, error: contentsError } = await query
  if (contentsError) console.error('[admin/contents] query failed:', contentsError.message)

  // 依頼: 「プレビューではなく、実際の販売写真が確認できるようにしてほしい」。
  // 従来はサムネイルが無いときだけ本体を署名URLで出していたため、サムネイル付きの商品は
  // 加工済みプレビューしか見えず、実際に売られる写真を審査できなかった。
  // 常に本体ファイル(file_url、非公開バケット)の署名URLを発行し、そちらを主表示にする。
  const admin = createAdminClient()
  const fileSignedUrls = new Map<string, string>()
  await Promise.all(
    (contents ?? [])
      .filter((c: any) => c.file_url)
      .map(async (c: any) => {
        const { data: signed } = await admin.storage.from('contents').createSignedUrl(c.file_url, 600)
        if (signed?.signedUrl) fileSignedUrls.set(c.id, signed.signedUrl)
      })
  )

  // 件数は全行を取得して数えると1000行で頭打ちになり、SLAバナーが過少表示になる。
  // head:true の件数取得に変えて件数だけを正確に得る。
  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, takedown: 0 }
  const countResults = await Promise.all([
    ...(['pending', 'approved', 'rejected'] as const).map(st =>
      supabase.from('contents').select('id', { count: 'exact', head: true }).eq('review_status', st)
    ),
    supabase.from('contents').select('id', { count: 'exact', head: true }).eq('hard_takedown', true),
  ])
  ;(['pending', 'approved', 'rejected', 'takedown'] as const).forEach((st, i) => {
    counts[st] = countResults[i].count ?? 0
  })

  const now = Date.now()

  const tabs: { key: Filter; label: string; count?: number; color?: string }[] = [
    { key: 'pending',  label: '新着・未確認', count: counts.pending,  color: '#d97706' },
    { key: 'approved', label: '承認済み', count: counts.approved, color: '#059669' },
    { key: 'rejected', label: '却下',     count: counts.rejected, color: '#dc2626' },
    { key: 'takedown', label: '配信停止', count: counts.takedown, color: '#7f1d1d' },
    { key: 'all',      label: 'すべて' },
  ]

  // 200件で切っている。件数バッジは正確なので、切れているときは明示する（既定非表示禁止）。
  const shownCount = contents?.length ?? 0
  const totalForFilter = filter === 'all' ? null : counts[filter]
  const truncated = totalForFilter != null && shownCount >= PAGE_LIMIT && totalForFilter > shownCount

  return (
    <div className="admin-page">
      <h1 className="admin-h1">商品管理・審査</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>投稿されたコンテンツの審査・承認・却下を管理します</p>

      {/* SLA Alert Banner */}
      {counts.pending > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="#d97706" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>未確認の新着出品が {counts.pending} 件あります</p>
            <p style={{ fontSize: 11, color: '#9a6a1a', marginTop: 2 }}>写真は審査を待たずに販売中です（事後チェック）。動画は「承認待ち」バッジのもので、承認するまで公開されません＝クリエイターが待っています。ガイドライン違反は「却下」で取り下げ、法令違反は「配信停止」（赤枠は投稿から24時間以上未確認）。</p>
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

      {contentsError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13, fontWeight: 600 }}>
          一覧を取得できませんでした（{contentsError.message}）。0件ではなく取得エラーです。
        </div>
      )}
      {truncated && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#92400e', fontSize: 12, fontWeight: 600 }}>
          {totalForFilter} 件中、{filter === 'pending' ? '古い順に' : '新しい順に'}最初の {shownCount} 件だけ表示しています。処理して件数を減らすと残りが出ます。
        </div>
      )}

      {!contents || contents.length === 0 ? (
        <div className="admin-empty">
          <Package size={40} />
          <p>該当するコンテンツはありません</p>
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
            // 実際に販売されるファイルを最優先。取得できないときのみサムネイルで代替する。
            const isRealFile = fileSignedUrls.has(c.id)
            const realSrc = fileSignedUrls.get(c.id) ?? c.thumbnail_url ?? null
            return (
              <div key={c.id} className="mm-card" style={{
                padding: '14px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                border: overdue ? '2px solid #dc2626' : '1px solid var(--mm-border)',
              }}>
                {/* 審査用の画像。依頼により「加工済みプレビュー」ではなく実際に売られる本体を主表示にする。 */}
                <div style={{ flexShrink: 0, width: 110 }}>
                  <div style={{ width: 110, height: 110, borderRadius: 8, background: 'var(--mm-bg)', overflow: 'hidden', position: 'relative' }}>
                    {realSrc && c.content_type === 'video' ? (
                      <video src={realSrc} muted controls={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : realSrc ? (
                      <img src={realSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--mm-text-muted)' }}>
                        <Package size={24} />
                      </div>
                    )}
                    <span style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>
                      {c.content_type === 'video' ? '🎥' : '📸'}
                    </span>
                    {isRealFile && (
                      <span style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(5,150,105,0.92)', color: 'white', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>
                        販売実物
                      </span>
                    )}
                  </div>
                  {realSrc && (
                    <a href={realSrc} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', marginTop: 5, fontSize: 10, fontWeight: 700, color: 'var(--mm-primary)', textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      原寸で開く →
                    </a>
                  )}
                  {isRealFile && c.thumbnail_url && (
                    <a href={c.thumbnail_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', marginTop: 3, fontSize: 10, color: 'var(--mm-text-muted)', textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      プレビュー画像
                    </a>
                  )}
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                      <Icon size={11} />{meta.label}
                    </span>
                    {c.hard_takedown && (
                      <span style={{ background: '#7f1d1d', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                        ⛔ 配信停止中（購入者のDLも停止）
                      </span>
                    )}
                    {/* pending の意味は v55 で「販売中・確認は事後」に変わったが、動画(v58)だけは
                        承認まで非公開。同じ列に混ざるので、どちらなのかを行ごとに明示する。 */}
                    {status === 'pending' && !c.hard_takedown && (
                      c.is_published ? (
                        <span style={{ background: '#d1fae5', color: '#065f46', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                          販売中（事後確認）
                        </span>
                      ) : c.content_type === 'video' ? (
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                          承認待ち（未公開・クリエイターが待っています）
                        </span>
                      ) : (
                        <span style={{ background: '#6b7280', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                          非公開（下書き）
                        </span>
                      )
                    )}
                    {c.moderated_at == null && (
                      <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                        AI未実行
                      </span>
                    )}
                    {c.ai_verdict && c.ai_verdict !== 'approved' && (
                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                        AI判定: {c.ai_verdict}
                      </span>
                    )}
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
                    by {c.creator?.username
                      ? <Link href={`/creator/${c.creator.username}`} style={{ color: 'var(--mm-primary)' }}>{c.creator.display_name ?? c.creator.username}</Link>
                      : <span style={{ color: 'var(--mm-text-muted)' }}>{c.creator?.display_name ?? '(不明)'}</span>}
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
                    <ModerationButtons contentId={c.id} currentStatus={status} isPublished={c.is_published} title={c.title} hardTakedown={!!c.hard_takedown} />
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
