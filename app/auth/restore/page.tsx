'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RestorePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const restore = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/account/restore', { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error ?? '復元に失敗しました')
      setLoading(false)
      return
    }
    router.push('/contents')
    router.refresh()
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, color: 'var(--mm-primary)' }}>My Focus</span>
          </Link>
        </div>

        <div className="mm-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔄</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>このアカウントは退会手続き中です</h2>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.8, marginBottom: 24 }}>
            退会申請から1年以内であれば、アカウントとデータをそのまま復元できます。<br />
            復元しない場合は、このままログアウトしてください。
          </p>

          {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={restore} disabled={loading}
              style={{ background: 'var(--mm-primary)', color: 'white', padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '処理中...' : 'アカウントを復元する'}
            </button>
            <button onClick={logout} disabled={loading}
              style={{ background: 'white', color: 'var(--mm-text-sub)', padding: 12, borderRadius: 8, fontWeight: 600, fontSize: 14, border: '1px solid var(--mm-border)', cursor: 'pointer' }}>
              ログアウトする
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
