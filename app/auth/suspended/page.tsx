'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { COMPANY } from '@/lib/config'

export default function SuspendedPage() {
  const router = useRouter()
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc('my_auth_gate_info')
      setReason(data?.[0]?.suspended_reason ?? null)
      setLoading(false)
    }
    load()
  }, [])

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
          <div style={{ fontSize: 40, marginBottom: 14 }}>🚫</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>このアカウントは現在ご利用いただけません</h2>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.8, marginBottom: 16 }}>
            運営によりアカウントの利用が停止されています。
          </p>
          {!loading && reason && (
            <div style={{ background: 'var(--mm-bg)', border: '1px solid var(--mm-border)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 700, marginBottom: 4 }}>理由</p>
              <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', whiteSpace: 'pre-wrap' }}>{reason}</p>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
            心当たりがない場合や解除をご希望の場合は、
            <a href={`mailto:${COMPANY.email}`} style={{ color: 'var(--mm-primary)', fontWeight: 600 }}>{COMPANY.email}</a>
            までお問い合わせください。
          </p>
          <button onClick={logout}
            style={{ background: 'white', color: 'var(--mm-text-sub)', padding: 12, borderRadius: 8, fontWeight: 600, fontSize: 14, border: '1px solid var(--mm-border)', cursor: 'pointer', width: '100%' }}>
            ログアウトする
          </button>
        </div>
      </div>
    </div>
  )
}
