'use client'

import { useState, useTransition } from 'react'
import { reviewVerification, getSignedUrl } from './actions'
import { Eye, CheckCircle2, XCircle } from 'lucide-react'

export default function ReviewPanel({ userId, idPath, selfiePath }: { userId: string; idPath: string | null; selfiePath: string | null }) {
  const [pending, start] = useTransition()
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [idUrl, setIdUrl] = useState<string | null>(null)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)

  const loadPreview = async (path: string, setter: (u: string) => void) => {
    const res = await getSignedUrl(path)
    if ('url' in res && res.url) setter(res.url)
    else alert(('error' in res && res.error) || 'プレビューURLの取得に失敗しました')
  }

  const doApprove = () => {
    if (!confirm('この申請を承認します。よろしいですか？')) return
    start(async () => {
      const res = await reviewVerification(userId, 'approve')
      if ((res as { error?: string }).error) alert((res as { error: string }).error)
    })
  }

  const doReject = () => {
    if (rejectReason.trim().length < 3) { alert('却下理由を3文字以上で入力してください'); return }
    start(async () => {
      const res = await reviewVerification(userId, 'reject', rejectReason)
      if ((res as { error?: string }).error) alert((res as { error: string }).error)
    })
  }

  return (
    <div>
      {/* プレビュー */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {idPath && (
          <div style={{ flex: '1 1 200px' }}>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>身分証</p>
            {idUrl ? (
              <a href={idUrl} target="_blank" rel="noreferrer">
                {idPath.toLowerCase().endsWith('.pdf')
                  ? <div style={{ padding: 10, background: '#f3f4f6', borderRadius: 6, fontSize: 12, textAlign: 'center' }}>PDFを開く ↗</div>
                  : <img src={idUrl} alt="身分証" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--mm-border)' }} />
                }
              </a>
            ) : (
              <button type="button" onClick={() => loadPreview(idPath, setIdUrl)} style={{ width: '100%', padding: '10px', background: 'white', border: '1px dashed var(--mm-border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Eye size={13} /> プレビュー取得（5分間有効）
              </button>
            )}
          </div>
        )}
        {selfiePath && (
          <div style={{ flex: '1 1 200px' }}>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>セルフィー</p>
            {selfieUrl ? (
              <a href={selfieUrl} target="_blank" rel="noreferrer">
                {selfiePath.toLowerCase().endsWith('.pdf')
                  ? <div style={{ padding: 10, background: '#f3f4f6', borderRadius: 6, fontSize: 12, textAlign: 'center' }}>PDFを開く ↗</div>
                  : <img src={selfieUrl} alt="セルフィー" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--mm-border)' }} />
                }
              </a>
            ) : (
              <button type="button" onClick={() => loadPreview(selfiePath, setSelfieUrl)} style={{ width: '100%', padding: '10px', background: 'white', border: '1px dashed var(--mm-border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Eye size={13} /> プレビュー取得（5分間有効）
              </button>
            )}
          </div>
        )}
      </div>

      {/* アクション */}
      {!showRejectForm ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={doApprove}
            disabled={pending}
            style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: pending ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <CheckCircle2 size={13} /> 承認
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={pending}
            style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: pending ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <XCircle size={13} /> 却下
          </button>
        </div>
      ) : (
        <div style={{ padding: 10, background: '#fef2f2', borderRadius: 6 }}>
          <p style={{ fontSize: 11, color: '#991b1b', fontWeight: 700, marginBottom: 6 }}>却下理由（クリエイターに通知されます）</p>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="例: 書類の文字が読み取れませんでした。より鮮明な画像で再提出してください。"
            rows={2}
            style={{ width: '100%', padding: 8, border: '1px solid #fca5a5', borderRadius: 4, fontSize: 12, marginBottom: 8, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={doReject} disabled={pending} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}>
              却下を確定
            </button>
            <button onClick={() => { setShowRejectForm(false); setRejectReason('') }} disabled={pending} style={{ background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
