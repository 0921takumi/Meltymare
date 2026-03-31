import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, CheckCircle, Upload } from 'lucide-react'

export default async function CreatorOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'creator') redirect('/contents')

  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, content:contents(id, title, thumbnail_url, price), buyer:profiles!purchases_user_id_fkey(id, display_name, email)')
    .eq('contents.creator_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  // creator_idでフィルタ（joinが効かない場合のフォールバック）
  const myContentIds = await supabase
    .from('contents')
    .select('id')
    .eq('creator_id', user.id)
    .then(r => r.data?.map(c => c.id) ?? [])

  const { data: allPurchases } = await supabase
    .from('purchases')
    .select('*, content:contents(id, title, thumbnail_url, price), buyer:profiles!purchases_user_id_fkey(id, display_name, email)')
    .in('content_id', myContentIds.length > 0 ? myContentIds : ['__none__'])
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const pendingOrders = allPurchases?.filter(p => p.delivery_status === 'pending') ?? []
  const deliveredOrders = allPurchases?.filter(p => p.delivery_status === 'delivered') ?? []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>注文管理</h1>
          <Link href="/creator/dashboard" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>
            ← ダッシュボードへ
          </Link>
        </div>

        {/* 未納品 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Clock size={16} color="#d97706" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>未納品</h2>
            {pendingOrders.length > 0 && (
              <span style={{ background: '#d97706', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {pendingOrders.length}件
              </span>
            )}
          </div>

          {pendingOrders.length === 0 ? (
            <div className="mm-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 14 }}>
              未納品の注文はありません
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingOrders.map((purchase: any) => (
                <OrderRow key={purchase.id} purchase={purchase} isPending={true} />
              ))}
            </div>
          )}
        </div>

        {/* 納品済み */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CheckCircle size={16} color="#059669" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>納品済み</h2>
          </div>

          {deliveredOrders.length === 0 ? (
            <div className="mm-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--mm-text-muted)', fontSize: 14 }}>
              まだ納品済みの注文はありません
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deliveredOrders.map((purchase: any) => (
                <OrderRow key={purchase.id} purchase={purchase} isPending={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OrderRow({ purchase, isPending }: { purchase: any; isPending: boolean }) {
  const content = purchase.content
  const buyer = purchase.buyer
  return (
    <div className="mm-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {/* サムネイル */}
      <div style={{ width: 52, height: 52, borderRadius: 6, background: 'var(--mm-primary-light)', flexShrink: 0, overflow: 'hidden' }}>
        {content?.thumbnail_url ? (
          <img src={content.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
        )}
      </div>
      {/* 情報 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content?.title ?? '(削除済み)'}</p>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>
          購入者: {buyer?.display_name ?? buyer?.email ?? '不明'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 1 }}>
          {new Date(purchase.created_at).toLocaleDateString('ja-JP')} · ¥{purchase.amount?.toLocaleString()}
        </p>
      </div>
      {/* アクション */}
      <div style={{ flexShrink: 0 }}>
        {isPending ? (
          <Link href={`/creator/orders/${purchase.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--mm-primary)', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Upload size={14} /> 納品する
          </Link>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#059669', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle size={14} /> 納品済み
          </div>
        )}
      </div>
    </div>
  )
}
