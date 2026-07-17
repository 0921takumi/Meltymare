'use client'

import { FileText } from 'lucide-react'

export default function ReceiptButton({ purchaseId, defaultName }: { purchaseId: string; defaultName: string }) {
  const issue = () => {
    const name = window.prompt('領収書の宛名（お名前・会社名）を入力してください', defaultName || '')
    if (name === null) return // キャンセル
    const url = `/api/purchase/${purchaseId}/receipt?name=${encodeURIComponent(name.trim())}`
    window.location.href = url
  }

  return (
    <button
      onClick={issue}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
        background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8,
        fontSize: 12, fontWeight: 600, color: 'var(--mm-text-sub)', cursor: 'pointer',
      }}
    >
      <FileText size={13} /> 領収書
    </button>
  )
}
