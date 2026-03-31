'use client'
import { useState } from 'react'
import { Plus, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react'

interface Banner {
  id: string
  title: string
  subtitle: string | null
  creator_id: string | null
  content_id: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
  creator?: { id: string; display_name: string; username: string } | null
  content?: { id: string; title: string } | null
}

interface Props {
  initialBanners: Banner[]
  creators: { id: string; display_name: string; username: string }[]
  contents: { id: string; title: string }[]
}

export default function BannerManager({ initialBanners, creators, contents }: Props) {
  const [banners, setBanners] = useState(initialBanners)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [contentId, setContentId] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          creator_id: creatorId || null,
          content_id: contentId || null,
          link_url: linkUrl.trim() || null,
          sort_order: banners.length,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setBanners(prev => [...prev, data])
      setTitle(''); setSubtitle(''); setCreatorId(''); setContentId(''); setLinkUrl('')
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (id: string, is_active: boolean) => {
    const res = await fetch('/api/banner', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    if (res.ok) setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/banner?id=${id}`, { method: 'DELETE' })
    if (res.ok) setBanners(prev => prev.filter(b => b.id !== id))
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> バナーを追加
        </button>
      </div>

      {showForm && (
        <div className="mm-card" style={{ padding: 24, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>バナー追加</p>
          <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>タイトル *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} placeholder="例: 今週のおすすめ" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>サブタイトル</label>
              <input value={subtitle} onChange={e => setSubtitle(e.target.value)} style={inputStyle} placeholder="例: 新しいコンテンツが登場！" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>クリエイター (任意)</label>
              <select value={creatorId} onChange={e => setCreatorId(e.target.value)} style={inputStyle}>
                <option value="">選択しない</option>
                {creators.map(c => <option key={c.id} value={c.id}>{c.display_name} (@{c.username})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>コンテンツ (任意)</label>
              <select value={contentId} onChange={e => setContentId(e.target.value)} style={inputStyle}>
                <option value="">選択しない</option>
                {contents.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>リンクURL (任意)</label>
              <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
            </div>
            {error && <p style={{ gridColumn: '1/-1', fontSize: 12, color: '#dc2626' }}>{error}</p>}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={creating} style={{ padding: '9px 20px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {creating ? '追加中...' : '追加する'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: 'white', color: 'var(--mm-text-muted)', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {banners.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mm-text-muted)' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🖼️</p>
          <p>まだバナーがありません</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {banners.map(b => (
            <div key={b.id} className="mm-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, opacity: b.is_active ? 1 : 0.6 }}>
              <GripVertical size={18} color="var(--mm-text-muted)" style={{ flexShrink: 0, cursor: 'grab' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700 }}>{b.title}</p>
                {b.subtitle && <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>{b.subtitle}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                  {b.creator && <span style={{ fontSize: 11, background: 'var(--mm-primary-light)', color: 'var(--mm-primary)', padding: '2px 8px', borderRadius: 10 }}>👤 {b.creator.display_name}</span>}
                  {b.content && <span style={{ fontSize: 11, background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 10 }}>📦 {b.content.title}</span>}
                  {b.link_url && <span style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>🔗 {b.link_url}</span>}
                </div>
              </div>
              <button onClick={() => toggleActive(b.id, b.is_active)} style={{ padding: 8, background: b.is_active ? '#f0fdf4' : 'var(--mm-bg)', border: '1px solid var(--mm-border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {b.is_active ? <Eye size={15} color="#059669" /> : <EyeOff size={15} color="var(--mm-text-muted)" />}
              </button>
              <button onClick={() => remove(b.id)} style={{ padding: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={15} color="#dc2626" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
