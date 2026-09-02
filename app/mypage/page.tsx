import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, Download, BookOpen } from 'lucide-react'
import ReceiptButton from './ReceiptButton'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()

  // 検証で判明した実害: 購入後に運営がその商品を取り下げる（却下=is_published false）と、
  // RLS越しの埋め込み取得では contents が null になり、購入履歴から行ごと消えて
  // ダウンロード・領収書に到達できなくなる（＝支払い済みの購入者が商品を失う）。
  // 購入者に自分が買ったものを見せるのは取り下げ後も必要なので、購入行はセッション
  // (自分の行のみRLSで保証) で取り、商品情報だけ service_role で取り直して合成する。
  const { data: purchaseRows } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const purchasedContentIds = [...new Set((purchaseRows ?? []).map((p: any) => p.content_id))]
  const contentById = new Map<string, any>()
  if (purchasedContentIds.length > 0) {
    const admin = createAdminClient()
    const COLS_WITH_TAKEDOWN = 'id, title, thumbnail_url, price, hard_takedown, creator:profiles!contents_creator_id_fkey(id, display_name)'
    const COLS_FALLBACK = 'id, title, thumbnail_url, price, creator:profiles!contents_creator_id_fkey(id, display_name)'
    let { data: rows, error } = await admin.from('contents').select(COLS_WITH_TAKEDOWN).in('id', purchasedContentIds)
    if (error) {
      // v57 未適用（hard_takedown 列が無い）でも購入履歴が空にならないようにする
      console.warn('[mypage] hard_takedown 列が未適用の可能性:', error.message)
      const retry = await admin.from('contents').select(COLS_FALLBACK).in('id', purchasedContentIds)
      rows = retry.data as any
    }
    for (const r of rows ?? []) contentById.set(r.id, r)
  }
  const purchases = (purchaseRows ?? []).map((p: any) => ({ ...p, content: contentById.get(p.content_id) ?? null }))

  // フォロー中クリエイター
  const { data: follows } = await supabase
    .from('follows')
    .select('creator:profiles!follows_creator_id_fkey(id, display_name, username, avatar_url)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const totalCount = purchases.length
  const deliveredCount = purchases.filter((p: any) => p.delivery_status === 'delivered').length
  const pendingCount = totalCount - deliveredCount

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* プロフィールヘッダー */}
        <div className="mm-card" style={{ padding: '20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.display_name}</p>
              <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--mm-primary)' }}>{totalCount}</p>
              <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>購入済み</p>
              {pendingCount > 0 && (
                <p style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 2 }}>納品待ち {pendingCount}件</p>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <a href="/polls" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>アンケート</a>
                <a href="/mypage/profile" style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600 }}>プロフィール編集</a>
              </div>
            </div>
          </div>
        </div>

        {/* 依頼で削除: 累計支援額(¥)・支援額ランキングへの導線を購入者画面から無くす。
            コレクション帳への導線だけ残す。 */}
        <div style={{ marginBottom: 22 }}>
          <Link href="/mypage/collection" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'white', border: '1px solid var(--mm-border)', borderRadius: 18, fontSize: 12, fontWeight: 700, color: '#a855f7', textDecoration: 'none' }}>
            <BookOpen size={13} />コレクション帳
          </Link>
        </div>

        {/* フォロー中クリエイター */}
        {follows && follows.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>フォロー中のクリエイター</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {follows.map((f: any) => {
                const c = f.creator
                if (!c) return null
                return (
                  <Link key={c.id} href={`/creator/${c.username}`} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 72 }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : '👤'}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--mm-text-sub)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontWeight: 600 }}>
                        {c.display_name}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>購入済みコンテンツ</h2>

        {!purchases || purchases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🛍️</p>
            <p style={{ fontSize: 16, marginBottom: 8 }}>まだ購入したコンテンツがありません</p>
            <a href="/contents" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>
              コンテンツを探す →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map((purchase: any) => {
              const content = purchase.content
              if (!content) return null
              const isDelivered = purchase.delivery_status === 'delivered'
              return (
                <div key={purchase.id} className="mm-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* サムネイル */}
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: 'var(--mm-primary-light)', flexShrink: 0, overflow: 'hidden' }}>
                    {/* 配信停止した商品は画像も出さない（法令違反として止めたものを購入者画面に描画し続けない） */}
                    {content.thumbnail_url && !content.hard_takedown ? (
                      <img src={content.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{content.hard_takedown ? '⛔' : '📷'}</div>
                    )}
                  </div>
                  {/* 情報 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {content.hard_takedown ? (
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.title}</p>
                    ) : (
                      <Link href={`/contents/${content.id}`} style={{ textDecoration: 'none' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.title}</p>
                      </Link>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {content.creator?.display_name} · ¥{content.price.toLocaleString()}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                      購入日: {new Date(purchase.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  {/* ステータス・アクション */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {content.hard_takedown ? (
                      // v57: 法令違反で配信停止した商品。黙って消すと購入者が混乱するため、
                      // 履歴には残したうえで停止した事実を明示する。
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12, fontWeight: 600, maxWidth: 200, lineHeight: 1.5 }}>
                        配信停止中<br />（運営にお問い合わせください）
                      </div>
                    ) : isDelivered ? (
                      <a href={`/api/download/${purchase.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#059669', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        <Download size={14} /> DL
                      </a>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, color: '#d97706', fontSize: 13, fontWeight: 600 }}>
                        <Clock size={14} /> 納品待ち
                      </div>
                    )}
                    <ReceiptButton purchaseId={purchase.id} defaultName={profile?.display_name ?? ''} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
