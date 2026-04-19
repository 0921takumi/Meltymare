'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Upload, CheckCircle, ArrowLeft } from 'lucide-react'

export default function DeliverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [purchaseId, setPurchaseId] = useState<string>('')
  const [profile, setProfile] = useState<any>(null)
  const [purchase, setPurchase] = useState<any>(null)
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    params.then(p => setPurchaseId(p.id))
  }, [params])

  useEffect(() => {
    if (!purchaseId) return
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'creator') { router.push('/contents'); return }
      setProfile(prof)

      const { data: p } = await supabase
        .from('purchases')
        .select('*, content:contents(id, title, thumbnail_url, price, creator_id), buyer:profiles!purchases_user_id_fkey(id, display_name, email)')
        .eq('id', purchaseId)
        .eq('status', 'completed')
        .single()

      if (!p || p.content?.creator_id !== user.id) {
        router.push('/creator/orders'); return
      }
      setPurchase(p)
      if (p.delivery_status === 'delivered') setDone(true)
    }
    init()
  }, [purchaseId, router])

  const handleDeliver = async () => {
    if (!deliveryFile) { setError('納品ファイルを選択してください'); return }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthorized')

      const { validateUpload } = await import('@/lib/sanitize')
      const kind: 'image' | 'video' = deliveryFile.type.startsWith('video/') ? 'video' : 'image'
      const v = validateUpload(deliveryFile, kind)
      if (!v.ok) throw new Error(v.error)

      const ext = (deliveryFile.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${user.id}/${purchaseId}_${Date.now()}.${ext || 'bin'}`
      const { error: upErr } = await supabase.storage.from('deliveries').upload(path, deliveryFile, {
        contentType: deliveryFile.type,
      })
      if (upErr) throw upErr

      const { error: updErr } = await supabase
        .from('purchases')
        .update({
          delivery_status: 'delivered',
          delivered_file_url: path,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', purchaseId)
      if (updErr) throw updErr

      // 納品完了メール送信（バックグラウンド）
      fetch('/api/notify/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_id: purchaseId }),
      }).catch(() => {})

      setDone(true)
    } catch (e: any) {
      setError(e.message ?? '納品に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!purchase) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--mm-text-muted)' }}>読み込み中...</p>
      </div>
    )
  }

  const content = purchase.content
  const buyer = purchase.buyer

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 600, margin: '0 auto' }}>

        <button onClick={() => router.push('/creator/orders')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mm-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, padding: 0 }}>
          <ArrowLeft size={15} /> 注文一覧に戻る
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>納品する</h1>

        {/* 注文情報 */}
        <div className="mm-card" style={{ padding: '20px', marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>注文情報</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--mm-primary-light)', flexShrink: 0, overflow: 'hidden' }}>
              {content?.thumbnail_url ? (
                <img src={content.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📷</div>}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700 }}>{content?.title}</p>
              <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                購入者: {buyer?.display_name ?? buyer?.email}
              </p>
              <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                購入日: {new Date(purchase.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>
          </div>
        </div>

        {done ? (
          <div className="mm-card" style={{ padding: '32px', textAlign: 'center' }}>
            <CheckCircle size={48} color="#059669" style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: '#059669', marginBottom: 8 }}>納品完了！</p>
            <p style={{ fontSize: 14, color: 'var(--mm-text-muted)', marginBottom: 20 }}>
              購入者がダウンロードできるようになりました
            </p>
            <button onClick={() => router.push('/creator/orders')}
              style={{ padding: '10px 24px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              注文一覧へ戻る
            </button>
          </div>
        ) : (
          <div className="mm-card" style={{ padding: '28px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>メッセージを書き込んだ写真・動画をアップロード</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              購入者向けにカスタマイズしたファイルをアップロードしてください。アップロード後、購入者にダウンロードが開放されます。
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', border: '2px dashed var(--mm-border)', borderRadius: 10, cursor: 'pointer', color: 'var(--mm-text-muted)', marginBottom: 20 }}>
              <Upload size={20} />
              <span style={{ fontSize: 14 }}>{deliveryFile ? deliveryFile.name : '納品ファイルを選択...'}</span>
              <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => setDeliveryFile(e.target.files?.[0] ?? null)} />
            </label>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{error}</p>
            )}

            <button onClick={handleDeliver} disabled={loading || !deliveryFile}
              style={{ width: '100%', padding: '13px', background: !deliveryFile || loading ? 'var(--mm-text-muted)' : 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: !deliveryFile || loading ? 'not-allowed' : 'pointer' }}>
              {loading ? '納品中...' : '納品する'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
