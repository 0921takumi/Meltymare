'use client'
import { useState } from 'react'
import Header from '@/components/layout/Header'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // TODO: 実際の送信処理（Resend等）
    await new Promise(r => setTimeout(r, 800))
    setDone(true)
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block' as const, fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }

  if (done) return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <div className="mm-card" style={{ padding: 40 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>✉️</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>送信しました</h2>
          <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>お問い合わせを受け付けました。<br />2〜3営業日以内にご返信いたします。</p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>お問い合わせ</h1>
        <div className="mm-card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>お名前 *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="山田 太郎" />
            </div>
            <div>
              <label style={labelStyle}>メールアドレス *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="mail@example.com" />
            </div>
            <div>
              <label style={labelStyle}>お問い合わせ内容 *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} required rows={5}
                style={{ ...inputStyle, resize: 'vertical' }} placeholder="ご質問・ご要望をお書きください" />
            </div>
            <button type="submit" disabled={loading}
              style={{ background: 'var(--mm-primary)', color: 'white', padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '送信中...' : '送信する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
