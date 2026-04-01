import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, Download } from 'lucide-react'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, content:contents(id, title, thumbnail_url, price, creator:profiles(id, display_name))')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  // フォロー中クリエイター
  const { data: follows } = await supabase
    .from('follows')
    .select('creator:profiles!follows_creator_id_fkey(id, display_name, username, avatar_url)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const totalCount = purchases?.length ?? 0
  const deliveredCount = purchases?.filter(p => p.delivery_status === 'delivered').length ?? 0
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
                <a href="/requests" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>リクエスト一覧</a>
                <a href="/mypage/profile" style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600 }}>プロフィール編集</a>
              </div>
            </div>
          </div>
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
                    {content.thumbnail_url ? (
                      <img src={content.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📷</div>
                    )}
                  </div>
                  {/* 情報 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/contents/${content.id}`} style={{ textDecoration: 'none' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.title}</p>
                    </Link>
                    <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                      {content.creator?.display_name} · ¥{content.price.toLocaleString()}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                      購入日: {new Date(purchase.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  {/* ステータス・アクション */}
                  <div style={{ flexShrink: 0 }}>
                    {isDelivered ? (
                      <a href={`/api/download/${purchase.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#059669', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        <Download size={14} /> DL
                      </a>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, color: '#d97706', fontSize: 13, fontWeight: 600 }}>
                        <Clock size={14} /> 納品待ち
                      </div>
                    )}
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
