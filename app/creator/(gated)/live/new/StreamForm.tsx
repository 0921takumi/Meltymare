'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Image as ImageIcon } from 'lucide-react'

export default function StreamForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 24)
    return d.toISOString().slice(0, 16)
  })
  const [isPremium, setIsPremium] = useState(false)
  const [premiumPrice, setPremiumPrice] = useState(500)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () => {
    if (!title.trim()) { setError('タイトルは必須です'); return }
    start(async () => {
      setError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('ログインしてください'); return }

      let thumbnailUrl: string | null = null
      if (thumbnail) {
        const ext = thumbnail.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('live-thumbnails').upload(path, thumbnail, { contentType: thumbnail.type })
        if (upErr) { setError(`サムネ失敗: ${upErr.message}`); return }
        const { data: pub } = supabase.storage.from('live-thumbnails').getPublicUrl(path)
        thumbnailUrl = pub.publicUrl
      }

      const res = await fetch('/api/live-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || null,
          stream_url: streamUrl || null,
          scheduled_at: new Date(scheduledAt).toISOString(),
          is_premium: isPremium, premium_price: isPremium ? premiumPrice : 0,
          thumbnail_url: thumbnailUrl,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? '登録に失敗しました')
        return
      }
      router.push('/creator/live')
    })
  }

  return (
    <div className="mm-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>{error}</div>}

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>タイトル *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
          style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>説明</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500}
          style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>配信URL (YouTube Live / Twitch 等)</label>
        <input value={streamUrl} onChange={e => setStreamUrl(e.target.value)} type="url" placeholder="https://..."
          style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>配信日時</label>
        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
          style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>サムネイル</label>
        <label style={{ display: 'block', marginTop: 4 }}>
          {thumbnailPreview ? (
            <div style={{ width: 200, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <img src={thumbnailPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={(e) => { e.preventDefault(); setThumbnail(null); setThumbnailPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>変更</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 200, aspectRatio: '16/9', border: '2px dashed var(--mm-border)', borderRadius: 8, color: 'var(--mm-text-muted)', fontSize: 12, cursor: 'pointer', flexDirection: 'column', gap: 6 }}>
              <ImageIcon size={20} />選択
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) { setThumbnail(f); setThumbnailPreview(URL.createObjectURL(f)) }
            }} />
        </label>
      </div>

      <div style={{ padding: 12, background: 'var(--mm-bg)', borderRadius: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} />
          有料配信にする
        </label>
        {isPremium && (
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>視聴料金 (¥)</label>
            <input type="number" value={premiumPrice} onChange={e => setPremiumPrice(Number(e.target.value))} min={100} step={100}
              style={{ width: 200, marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13 }} />
          </div>
        )}
      </div>

      <button onClick={submit} disabled={pending} style={{
        padding: '12px 24px', background: '#dc2626', color: 'white',
        border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 700,
        cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
      }}>
        {pending ? '登録中...' : '配信を予約する'}
      </button>
    </div>
  )
}
