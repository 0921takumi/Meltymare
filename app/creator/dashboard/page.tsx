import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Eye, EyeOff, ClipboardList, MessageSquare, Tag } from 'lucide-react'

export default async function CreatorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'creator') redirect('/contents')

  const { data: contents } = await supabase
    .from('contents')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  const contentIds = contents?.map(c => c.id) ?? []
  const { data: completedPurchases } = contentIds.length > 0
    ? await supabase.from('purchases').select('*').in('content_id', contentIds).eq('status', 'completed')
    : { data: [] }

  const pendingCount = completedPurchases?.filter(p => (p as any).delivery_status === 'pending').length ?? 0

  // リクエスト pending 件数
  const { count: pendingRequestCount } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user.id)
    .eq('status', 'pending')

  // コンテンツ売上（商品代金のみ、チップ除く） / チップ売上 / 販売件数
  const contentSales = completedPurchases?.reduce((sum, p) => sum + ((p as any).content_price ?? p.amount ?? 0), 0) ?? 0
  const tipSales = completedPurchases?.reduce((sum, p) => sum + ((p as any).tip_amount ?? 0), 0) ?? 0
  const tipCount = completedPurchases?.filter(p => ((p as any).tip_amount ?? 0) > 0).length ?? 0
  const totalSold = completedPurchases?.length ?? 0

  const feeRate = profile?.fee_rate ?? 30
  // 手数料はコンテンツ売上にのみかかる（チップは手数料0%、全額クリエイターへ）
  const feeAmount = Math.floor(contentSales * feeRate / 100)
  const contentNet = contentSales - feeAmount
  const netAmount = contentNet + tipSales
  const totalSales = contentSales + tipSales

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>管理ダッシュボード</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/creator/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, background: pendingCount > 0 ? '#d97706' : 'white', color: pendingCount > 0 ? 'white' : 'var(--mm-primary)', border: `1px solid ${pendingCount > 0 ? '#d97706' : 'var(--mm-primary)'}`, padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <ClipboardList size={15} /> 注文管理{pendingCount > 0 ? ` (未納品 ${pendingCount}件)` : ''}
            </Link>
            <Link href="/creator/requests" style={{ display: 'flex', alignItems: 'center', gap: 6, background: (pendingRequestCount ?? 0) > 0 ? '#7c3aed' : 'white', color: (pendingRequestCount ?? 0) > 0 ? 'white' : 'var(--mm-text-sub)', border: `1px solid ${(pendingRequestCount ?? 0) > 0 ? '#7c3aed' : 'var(--mm-border)'}`, padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <MessageSquare size={15} /> リクエスト{(pendingRequestCount ?? 0) > 0 ? ` (${pendingRequestCount}件)` : ''}
            </Link>
            <Link href="/creator/coupons" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: 'var(--mm-text-sub)', border: '1px solid var(--mm-border)', padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <Tag size={15} /> クーポン
            </Link>
            <Link href="/creator/upload" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--mm-primary)', color: 'white', padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <Plus size={15} /> コンテンツ追加
            </Link>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="mm-creator-stats" style={{ marginBottom: 16 }}>
          {[
            { label: 'コンテンツ数', value: `${contents?.length ?? 0} 件`, color: 'var(--mm-primary)', sub: null },
            { label: '総販売数', value: `${totalSold} 件`, color: '#7c3aed', sub: null },
            { label: 'コンテンツ売上', value: `¥${contentSales.toLocaleString()}`, color: '#059669', sub: '税込' },
            { label: `手数料 (${feeRate}%)`, value: `¥${feeAmount.toLocaleString()}`, color: '#dc2626', sub: '運営取り分' },
            { label: '振込予定額', value: `¥${netAmount.toLocaleString()}`, color: 'var(--mm-primary)', sub: '売上 - 手数料 + チップ' },
          ].map((s, i) => (
            <div key={i} className="mm-card" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
              {s.sub && <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* 応援チップ売上（別枠） */}
        <div className="mm-card" style={{ padding: '18px 20px', marginBottom: 28, background: 'linear-gradient(135deg, #fefaf3 0%, #ffffff 100%)', border: '1px solid #e8d7b4' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: '#8a6a3f', fontWeight: 700, marginBottom: 4 }}>♥ 応援チップ売上</p>
              <p style={{ fontSize: 11, color: '#a78968' }}>チップは手数料0%、全額クリエイターへ還元されます</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#b8956a' }}>¥{tipSales.toLocaleString()}</p>
              <p style={{ fontSize: 11, color: '#a78968', marginTop: 2 }}>{tipCount}件のサポーターから</p>
            </div>
          </div>
        </div>

        {/* コンテンツ一覧テーブル */}
        <div className="mm-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 15 }}>
            コンテンツ一覧
          </div>
          {!contents || contents.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--mm-text-muted)' }}>
              <p style={{ marginBottom: 12 }}>まだコンテンツがありません</p>
              <Link href="/creator/upload" style={{ color: 'var(--mm-primary)', fontWeight: 600, fontSize: 14 }}>
                最初のコンテンツを追加 →
              </Link>
            </div>
          ) : (
            <div className="mm-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--mm-bg)' }}>
                  {['タイトル', '種別', '価格', '在庫', '販売数', '状態', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contents.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: c.content_type === 'video' ? '#ede9fe' : 'var(--mm-primary-light)', color: c.content_type === 'video' ? '#7c3aed' : 'var(--mm-primary)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                        {c.content_type === 'video' ? '動画' : '画像'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--mm-primary)' }}>¥{c.price.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--mm-text-sub)' }}>{c.stock_limit ?? '無制限'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--mm-text-sub)' }}>{c.sold_count}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.is_published ? '#059669' : 'var(--mm-text-muted)', fontWeight: 600 }}>
                        {c.is_published ? <><Eye size={13} /> 公開</> : <><EyeOff size={13} /> 非公開</>}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/creator/upload?edit=${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mm-primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                        <Edit size={13} /> 編集
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
