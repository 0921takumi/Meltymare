'use client'
import { useState } from 'react'

const CATEGORIES = [
  { value: 'general', label: 'サービスに関する質問' },
  { value: 'bug', label: '不具合・エラー' },
  { value: 'payment', label: '決済・返金について' },
  { value: 'account', label: 'アカウントについて' },
  { value: 'creator', label: 'クリエイター登録・出品について' },
  { value: 'other', label: 'その他' },
] as const

export default function ContactForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [category, setCategory] = useState<string>('general')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, subject, message: body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '送信に失敗しました')
      setDone(true)
    } catch (e: any) {
      setError(e.message ?? '送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)',
  }

  if (done) {
    return (
      <div className="mm-card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 44, marginBottom: 16 }}>✉️</p>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>送信しました</h2>
        <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>
          お問い合わせを受け付けました。<br />
          ご入力いただいたメールアドレスに確認メールをお送りしました。<br />
          通常2営業日以内にご返信いたします。
        </p>
      </div>
    )
  }

  return (
    <div className="mm-card" style={{ padding: 28 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>お名前 <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="山田 太郎" />
        </div>

        <div>
          <label style={labelStyle}>メールアドレス <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="mail@example.com" />
        </div>

        <div>
          <label style={labelStyle}>お問い合わせ種別 <span style={{ color: '#ef4444' }}>*</span></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>件名 <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={100} style={inputStyle} placeholder="例: 購入したコンテンツがダウンロードできません" />
        </div>

        <div>
          <label style={labelStyle}>お問い合わせ内容 <span style={{ color: '#ef4444' }}>*</span></label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={7} maxLength={2000}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
            placeholder="ご質問・ご要望を具体的にお書きください" />
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4, textAlign: 'right' }}>{body.length}/2000</p>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#ef4444', padding: '10px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</p>
        )}

        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', lineHeight: 1.7 }}>
          送信いただいた内容は <a href="/privacy" style={{ color: 'var(--mm-primary)' }}>プライバシーポリシー</a> に基づき適切に管理します。
        </p>

        <button type="submit" disabled={loading}
          style={{
            background: loading ? '#ccc' : 'var(--mm-primary)', color: 'white',
            padding: '14px 20px', borderRadius: 10, fontWeight: 700, fontSize: 15,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '送信中...' : '送信する'}
        </button>
      </form>
    </div>
  )
}
