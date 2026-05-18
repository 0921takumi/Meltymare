'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AccountSettingsForm({ email }: { email: string }) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState(email)
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteMsg, setDeleteMsg] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMsg(null)
    if (newEmail === email) {
      setEmailMsg({ type: 'err', text: '現在のメールアドレスと同じです' })
      return
    }
    setEmailLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setEmailMsg({ type: 'err', text: error.message })
    } else {
      setEmailMsg({ type: 'ok', text: '確認メールを送信しました。新しいアドレスのリンクをクリックして完了してください。' })
    }
    setEmailLoading(false)
  }

  const handlePwChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (newPw.length < 8) {
      setPwMsg({ type: 'err', text: 'パスワードは8文字以上で入力してください' })
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'パスワードが一致しません' })
      return
    }
    setPwLoading(true)
    const supabase = createClient()
    // 現在のパスワードで再認証
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signErr) {
      setPwMsg({ type: 'err', text: '現在のパスワードが正しくありません' })
      setPwLoading(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwMsg({ type: 'err', text: error.message })
    } else {
      setPwMsg({ type: 'ok', text: 'パスワードを更新しました' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setPwLoading(false)
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') {
      setDeleteMsg('確認文字列が一致しません')
      return
    }
    if (!confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return
    setDeleting(true)
    setDeleteMsg('')
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (res.ok) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/?deleted=1')
    } else {
      const j = await res.json().catch(() => ({}))
      setDeleteMsg(j.error ?? '削除に失敗しました')
      setDeleting(false)
    }
  }

  const cardStyle: React.CSSProperties = { padding: 24, marginBottom: 20 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }
  const msgStyle = (type: 'ok' | 'err'): React.CSSProperties => ({
    fontSize: 13, padding: '10px 14px', borderRadius: 8, marginTop: 12,
    color: type === 'ok' ? '#059669' : '#dc2626',
    background: type === 'ok' ? '#ecfdf5' : '#fef2f2',
  })

  return (
    <>
      {/* メールアドレス変更 */}
      <div className="mm-card" style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>メールアドレス</h2>
        <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>新しいメールアドレス</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required style={inputStyle} />
          </div>
          {emailMsg && <p style={msgStyle(emailMsg.type)}>{emailMsg.text}</p>}
          <button type="submit" disabled={emailLoading}
            style={{ background: 'var(--mm-primary)', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, border: 'none', cursor: emailLoading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', opacity: emailLoading ? 0.7 : 1 }}>
            {emailLoading ? '送信中...' : 'メールアドレスを変更'}
          </button>
        </form>
      </div>

      {/* パスワード変更 */}
      <div className="mm-card" style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>パスワード変更</h2>
        <form onSubmit={handlePwChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>現在のパスワード</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>新しいパスワード（8文字以上）</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>新しいパスワード（確認）</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required style={inputStyle} />
          </div>
          {pwMsg && <p style={msgStyle(pwMsg.type)}>{pwMsg.text}</p>}
          <button type="submit" disabled={pwLoading}
            style={{ background: 'var(--mm-primary)', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, border: 'none', cursor: pwLoading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', opacity: pwLoading ? 0.7 : 1 }}>
            {pwLoading ? '更新中...' : 'パスワードを変更'}
          </button>
        </form>
      </div>

      {/* アカウント削除 */}
      <div className="mm-card" style={{ ...cardStyle, border: '1px solid #fecaca' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#dc2626' }}>アカウント削除</h2>
        <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 14 }}>
          アカウントを削除すると、プロフィール・フォロー・リクエスト情報が完全に削除されます。<br />
          購入履歴は会計・法令上の理由で一定期間保持されます。<br />
          <strong>この操作は取り消せません。</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>確認のため「DELETE」と入力してください</label>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={inputStyle} />
          </div>
          {deleteMsg && <p style={{ fontSize: 13, color: '#dc2626' }}>{deleteMsg}</p>}
          <button type="button" onClick={handleDelete} disabled={deleting || deleteConfirm !== 'DELETE'}
            style={{ background: '#dc2626', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, border: 'none', cursor: (deleting || deleteConfirm !== 'DELETE') ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', opacity: (deleting || deleteConfirm !== 'DELETE') ? 0.5 : 1 }}>
            {deleting ? '削除中...' : 'アカウントを削除'}
          </button>
        </div>
      </div>
    </>
  )
}
