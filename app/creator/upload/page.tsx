'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Upload, ImageIcon, VideoIcon } from 'lucide-react'

function UploadForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = !!editId

  const [profile, setProfile] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stockLimit, setStockLimit] = useState('')
  const [contentType, setContentType] = useState<'image' | 'video'>('image')
  const [isPublished, setIsPublished] = useState(false)
  const [contentFile, setContentFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)

      if (isEdit && editId) {
        const { data: content } = await supabase.from('contents').select('*').eq('id', editId).single()
        if (content) {
          setTitle(content.title)
          setDescription(content.description ?? '')
          setPrice(String(content.price))
          setStockLimit(content.stock_limit ? String(content.stock_limit) : '')
          setContentType(content.content_type)
          setIsPublished(content.is_published)
        }
      }
    }
    init()
  }, [editId, isEdit, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      let fileUrl = ''
      let thumbnailUrl = ''

      if (!isEdit && !contentFile) throw new Error('ファイルを選択してください')

      if (contentFile) {
        const ext = contentFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('contents').upload(path, contentFile)
        if (upErr) throw upErr
        fileUrl = path
      }

      if (thumbnailFile) {
        const ext = thumbnailFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_thumb.${ext}`
        const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, thumbnailFile)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(path)
        thumbnailUrl = urlData.publicUrl
      }

      const payload: any = {
        title,
        description: description || null,
        price: parseInt(price),
        content_type: contentType,
        stock_limit: stockLimit ? parseInt(stockLimit) : null,
        is_published: isPublished,
      }
      if (fileUrl) payload.file_url = fileUrl
      if (thumbnailUrl) payload.thumbnail_url = thumbnailUrl

      if (isEdit) {
        const { error: updErr } = await supabase.from('contents').update(payload).eq('id', editId)
        if (updErr) throw updErr
      } else {
        payload.creator_id = user.id
        const { error: insErr } = await supabase.from('contents').insert(payload)
        if (insErr) throw insErr
      }

      router.push('/creator/dashboard')
    } catch (e: any) {
      setError(e.message ?? '保存に失敗しました')
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block' as const, fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>{isEdit ? 'コンテンツ編集' : 'コンテンツ追加'}</h1>

        <div className="mm-card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <label style={labelStyle}>タイトル *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} placeholder="コンテンツのタイトル" />
            </div>

            <div>
              <label style={labelStyle}>説明</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} placeholder="どんなコンテンツか説明してください" />
            </div>

            <div>
              <label style={labelStyle}>種別 *</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {(['image', 'video'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setContentType(t)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', border: `2px solid ${contentType === t ? 'var(--mm-primary)' : 'var(--mm-border)'}`, borderRadius: 8, background: contentType === t ? 'var(--mm-primary-light)' : 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: contentType === t ? 'var(--mm-primary)' : 'var(--mm-text-sub)' }}>
                    {t === 'image' ? <ImageIcon size={16} /> : <VideoIcon size={16} />}
                    {t === 'image' ? '画像' : '動画'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>価格（円）*</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} required min={100}
                style={inputStyle} placeholder="例: 500" />
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>最低100円から設定できます</p>
            </div>

            <div>
              <label style={labelStyle}>販売数上限（空欄 = 無制限）</label>
              <input type="number" value={stockLimit} onChange={e => setStockLimit(e.target.value)} min={1}
                style={inputStyle} placeholder="例: 30（空欄で無制限）" />
            </div>

            {!isEdit && (
              <div>
                <label style={labelStyle}>コンテンツファイル *</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', border: '2px dashed var(--mm-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--mm-text-muted)' }}>
                  <Upload size={18} />
                  <span style={{ fontSize: 14 }}>{contentFile ? contentFile.name : 'ファイルを選択...'}</span>
                  <input type="file" accept={contentType === 'image' ? 'image/*' : 'video/*'} style={{ display: 'none' }} onChange={e => setContentFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}

            <div>
              <label style={labelStyle}>サムネイル画像{isEdit ? '（変更する場合のみ）' : ''}</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', border: '2px dashed var(--mm-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--mm-text-muted)' }}>
                <ImageIcon size={18} />
                <span style={{ fontSize: 14 }}>{thumbnailFile ? thumbnailFile.name : 'サムネイルを選択...'}</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--mm-bg)', borderRadius: 8 }}>
              <input type="checkbox" id="published" checked={isPublished} onChange={e => setIsPublished(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <label htmlFor="published" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>公開する</label>
              <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>チェックを入れると一覧に表示されます</span>
            </div>

            {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => router.back()}
                style={{ flex: 1, padding: 12, border: '1px solid var(--mm-border)', borderRadius: 8, background: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--mm-text-sub)' }}>
                キャンセル
              </button>
              <button type="submit" disabled={loading}
                style={{ flex: 2, padding: 12, background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? '保存中...' : isEdit ? '更新する' : '登録する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>}>
      <UploadForm />
    </Suspense>
  )
}
