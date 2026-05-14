'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { ShieldCheck, Upload, AlertCircle, CheckCircle2, Clock, XCircle, FileText, User } from 'lucide-react'

const ACCEPT_MIME = 'image/jpeg,image/png,image/heic,application/pdf'
const MAX_BYTES = 10 * 1024 * 1024

type IdentityStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected'

const STATUS_META: Record<IdentityStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number }>; desc: string }> = {
  unsubmitted: { label: '未提出', color: '#6b7280', bg: '#f3f4f6', icon: AlertCircle, desc: '本人確認書類をアップロードしてください' },
  pending:     { label: '審査中', color: '#d97706', bg: '#fef3c7', icon: Clock, desc: '運営で確認中です。通常2〜3営業日以内に結果をお知らせします' },
  approved:    { label: '承認済み', color: '#059669', bg: '#d1fae5', icon: CheckCircle2, desc: '本人確認が完了しました。コンテンツの販売が可能です' },
  rejected:    { label: '却下', color: '#dc2626', bg: '#fee2e2', icon: XCircle, desc: '書類に不備がありました。理由をご確認の上、再提出してください' },
}

export default function CreatorVerificationPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [idFile, setIdFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!data || (data.role !== 'creator' && data.role !== 'user')) { router.push('/'); return }
      setProfile(data)
      if (data.birthdate) setBirthdate(data.birthdate)
      setLoading(false)
    }
    init()
  }, [router])

  const validateFile = (f: File) => {
    if (!ACCEPT_MIME.split(',').includes(f.type)) return 'JPEG / PNG / HEIC / PDF 形式のみアップロード可能です'
    if (f.size > MAX_BYTES) return `ファイルサイズは10MB以下にしてください（${Math.round(f.size / 1024 / 1024)}MB）`
    return null
  }

  const ageOk = (b: string) => {
    if (!b) return false
    const d = new Date(b)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    const m = now.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
    return age >= 18
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!birthdate) { setError('生年月日を入力してください'); return }
    if (!ageOk(birthdate)) { setError('18歳未満の方はご利用いただけません'); return }
    if (!idFile) { setError('身分証をアップロードしてください'); return }
    if (!selfieFile) { setError('セルフィーをアップロードしてください'); return }

    const idErr = validateFile(idFile); if (idErr) { setError(`身分証: ${idErr}`); return }
    const selfieErr = validateFile(selfieFile); if (selfieErr) { setError(`セルフィー: ${selfieErr}`); return }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインしていません')

      const ts = Date.now()
      const idExt = (idFile.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const selfieExt = (selfieFile.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const idPath = `${user.id}/idcard_${ts}.${idExt}`
      const selfiePath = `${user.id}/selfie_${ts}.${selfieExt}`

      const up1 = await supabase.storage.from('identity_documents').upload(idPath, idFile, { contentType: idFile.type, upsert: false })
      if (up1.error) throw up1.error
      const up2 = await supabase.storage.from('identity_documents').upload(selfiePath, selfieFile, { contentType: selfieFile.type, upsert: false })
      if (up2.error) throw up2.error

      const { error: updErr } = await supabase.from('profiles').update({
        identity_document_url: idPath,
        identity_selfie_url: selfiePath,
        identity_status: 'pending',
        identity_submitted_at: new Date().toISOString(),
        identity_rejection_reason: null,
        birthdate,
      }).eq('id', user.id)
      if (updErr) throw updErr

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setIdFile(null)
      setSelfieFile(null)
    } catch (err: any) {
      setError(err.message ?? 'アップロードに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
        <Header user={null} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--mm-text-muted)' }}>読み込み中...</div>
      </div>
    )
  }

  const status = (profile?.identity_status ?? 'unsubmitted') as IdentityStatus
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon
  const canSubmit = status === 'unsubmitted' || status === 'rejected'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <ShieldCheck size={22} color="var(--mm-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>本人確認</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', lineHeight: 1.6 }}>
            クリエイター規約第3条に基づき、本人確認（年齢確認）が必要です。書類は暗号化されて保管され、審査目的以外には使用されません。
          </p>
        </div>

        {/* ステータスカード */}
        <div className="mm-card" style={{ padding: '16px 20px', marginBottom: 18, borderLeft: `4px solid ${meta.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>
              <StatusIcon size={13} /> {meta.label}
            </span>
            {profile?.identity_submitted_at && (
              <span style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>
                提出日: {new Date(profile.identity_submitted_at).toLocaleDateString('ja-JP')}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>{meta.desc}</p>
          {status === 'rejected' && profile?.identity_rejection_reason && (
            <div style={{ marginTop: 10, padding: 10, background: '#fef2f2', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
              <strong>却下理由:</strong> {profile.identity_rejection_reason}
            </div>
          )}
        </div>

        {canSubmit && (
          <form onSubmit={handleSubmit} className="mm-card" style={{ padding: '20px 22px' }}>
            {/* 生年月日 */}
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'block' }}>生年月日 <span style={{ color: '#dc2626' }}>*</span></span>
              <input
                type="date"
                value={birthdate}
                onChange={e => setBirthdate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4, display: 'block' }}>18歳以上の方のみご利用いただけます</span>
            </label>

            {/* 身分証 */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> 身分証明書 <span style={{ color: '#dc2626' }}>*</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                運転免許証 / パスポート / マイナンバーカード（表面のみ） / 在留カード のいずれか。<br />
                氏名・生年月日・顔写真がはっきり写るように撮影してください。
              </p>
              <label style={{ display: 'block', padding: '14px', border: '2px dashed var(--mm-border)', borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: idFile ? '#f0fdf4' : 'white' }}>
                <input type="file" accept={ACCEPT_MIME} onChange={e => setIdFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
                <Upload size={18} style={{ marginBottom: 4, color: 'var(--mm-text-muted)' }} />
                <p style={{ fontSize: 12, color: idFile ? '#059669' : 'var(--mm-text-sub)', fontWeight: 600 }}>
                  {idFile ? `✓ ${idFile.name}` : 'クリックしてファイルを選択（JPEG/PNG/PDF、10MBまで）'}
                </p>
              </label>
            </div>

            {/* セルフィー */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} /> セルフィー（身分証と一緒に撮影） <span style={{ color: '#dc2626' }}>*</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                身分証を手に持ち、お顔と一緒に撮影してください。顔と身分証の両方がはっきり写っている必要があります。
              </p>
              <label style={{ display: 'block', padding: '14px', border: '2px dashed var(--mm-border)', borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: selfieFile ? '#f0fdf4' : 'white' }}>
                <input type="file" accept={ACCEPT_MIME} onChange={e => setSelfieFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
                <Upload size={18} style={{ marginBottom: 4, color: 'var(--mm-text-muted)' }} />
                <p style={{ fontSize: 12, color: selfieFile ? '#059669' : 'var(--mm-text-sub)', fontWeight: 600 }}>
                  {selfieFile ? `✓ ${selfieFile.name}` : 'クリックしてファイルを選択（JPEG/PNG、10MBまで）'}
                </p>
              </label>
            </div>

            {error && (
              <div style={{ padding: 10, background: '#fef2f2', borderRadius: 6, fontSize: 12, color: '#991b1b', marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 11, color: 'var(--mm-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
              ・提出された書類は暗号化の上、審査目的のみに使用されます<br />
              ・審査には通常2〜3営業日いただきます<br />
              ・承認後の書類は犯罪収益移転防止法に基づき規定期間保管されます
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px', background: submitting ? '#9ca3af' : 'var(--mm-primary)',
                color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'アップロード中...' : '本人確認書類を提出する'}
            </button>
          </form>
        )}

        {!canSubmit && status === 'pending' && (
          <div className="mm-card" style={{ padding: 24, textAlign: 'center', color: 'var(--mm-text-muted)' }}>
            <Clock size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ fontSize: 13 }}>審査結果が出るまでお待ちください</p>
          </div>
        )}

        {!canSubmit && status === 'approved' && (
          <div className="mm-card" style={{ padding: 24, textAlign: 'center' }}>
            <CheckCircle2 size={32} color="#059669" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>本人確認完了</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>コンテンツの販売が可能です</p>
          </div>
        )}
      </div>
    </div>
  )
}
