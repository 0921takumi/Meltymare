'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'

export default function ProfileEditPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        setDisplayName(data.display_name ?? '')
        setBio(data.bio ?? '')
        setTwitterUrl(data.twitter_url ?? '')
        setInstagramUrl(data.instagram_url ?? '')
        setTiktokUrl(data.tiktok_url ?? '')
      }
    }
    init()
  }, [router])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      let avatarUrl = profile?.avatar_url
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${user.id}/avatar.${ext}`
        await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = urlData.publicUrl
      }

      const { error: updateError } = await supabase.from('profiles').update({
        display_name: displayName,
        bio: bio || null,
        twitter_url: twitterUrl || null,
        instagram_url: instagramUrl || null,
        tiktok_url: tiktokUrl || null,
        avatar_url: avatarUrl,
      }).eq('id', user.id)

      if (updateError) throw updateError
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message ?? '保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block' as const, fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>プロフィール編集</h1>

        <div className="mm-card" style={{ padding: 32 }}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* アバター */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                {avatarPreview || profile?.avatar_url
                  ? <img src={avatarPreview || profile?.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '👤'}
              </div>
              <div>
                <label style={{ display: 'inline-block', padding: '8px 16px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--mm-text-sub)' }}>
                  画像を変更
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </label>
                <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>JPG / PNG 推奨</p>
              </div>
            </div>

            {/* 表示名 */}
            <div>
              <label style={labelStyle}>表示名 *</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inputStyle} />
            </div>

            {/* bio */}
            <div>
              <label style={labelStyle}>自己紹介</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} placeholder="プロフィールに表示される自己紹介文" />
            </div>

            {/* SNS */}
            <div style={{ borderTop: '1px solid var(--mm-border)', paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--mm-text)' }}>SNSリンク</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'X (Twitter) URL', value: twitterUrl, setter: setTwitterUrl, placeholder: 'https://x.com/yourname' },
                  { label: 'Instagram URL', value: instagramUrl, setter: setInstagramUrl, placeholder: 'https://instagram.com/yourname' },
                  { label: 'TikTok URL', value: tiktokUrl, setter: setTiktokUrl, placeholder: 'https://tiktok.com/@yourname' },
                ].map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <label style={labelStyle}>{label}</label>
                    <input type="url" value={value} onChange={e => setter(e.target.value)} style={inputStyle} placeholder={placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

            <button type="submit" disabled={loading}
              style={{ background: saved ? '#059669' : 'var(--mm-primary)', color: 'white', padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background 0.3s' }}>
              {loading ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
