'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, Image as ImageIcon } from 'lucide-react'

const MAX_SIZE = 30 * 1024 * 1024 // 30MB

export default function StoryUploader() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const handleFile = (f: File | null) => {
    setError(null)
    if (!f) return
    if (f.size > MAX_SIZE) { setError('ファイルが30MBを超えています'); return }
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      setError('画像または動画のみ対応'); return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = () => {
    if (!file) { setError('ファイルを選択してください'); return }
    start(async () => {
      setError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('ログインしてください'); return }

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const mediaType = file.type.startsWith('video') ? 'video' : 'image'

      const { error: upErr } = await supabase.storage.from('stories').upload(path, file, { contentType: file.type })
      if (upErr) { setError(`アップロード失敗: ${upErr.message}`); return }

      const { data: pub } = supabase.storage.from('stories').getPublicUrl(path)
      const { error: insertErr } = await supabase.from('stories').insert({
        creator_id: user.id,
        media_url: pub.publicUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
      })
      if (insertErr) { setError(`登録失敗: ${insertErr.message}`); return }

      setFile(null)
      setPreview(null)
      setCaption('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  return (
    <div className="mm-card" style={{ padding: 22 }}>
      {error && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {!preview ? (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: '40px 20px', border: '2px dashed var(--mm-border)', borderRadius: 12,
          cursor: 'pointer', background: 'var(--mm-bg)',
        }}>
          <ImageIcon size={32} color="var(--mm-text-muted)" />
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text-sub)' }}>画像/動画を選択</p>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>最大30MB · 24時間で自動削除</p>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e => handleFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
        </label>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 180, aspectRatio: '9/16', borderRadius: 10, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
            {file?.type.startsWith('video') ? (
              <video src={preview} controls muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="キャプション (任意)"
              rows={3}
              maxLength={200}
              style={{ padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={pending} style={{
                padding: '10px 22px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                color: 'white', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Upload size={14} />{pending ? '投稿中...' : 'ストーリーを投稿'}
              </button>
              <button onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ padding: '10px 18px', background: 'transparent', border: '1px solid var(--mm-border)', borderRadius: 999, fontSize: 13, cursor: 'pointer' }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
