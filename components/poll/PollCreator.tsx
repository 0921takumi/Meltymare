'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, BarChart3 } from 'lucide-react'

export default function PollCreator() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setOpt = (i: number, v: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  const addOpt = () => setOptions((prev) => (prev.length < 4 ? [...prev, ''] : prev))
  const removeOpt = (i: number) => setOptions((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev))

  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim()) { setError('質問を入力してください'); return }
    if (opts.length < 2) { setError('選択肢は2個以上必要です'); return }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: opts }),
      })
      if (res.ok) {
        setQuestion('')
        setOptions(['', ''])
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? '作成に失敗しました')
      }
    } catch {
      setError('作成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--mm-surface)', border: '1px solid var(--mm-border)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChart3 size={18} color="var(--mm-primary)" />
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>アンケートを作成</h2>
      </div>

      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text-sub)', display: 'block', marginBottom: 6 }}>質問</label>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={200}
        placeholder="例: 次に作ってほしいのは？"
        style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
      />

      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text-sub)', display: 'block', marginBottom: 6 }}>
        選択肢（2〜4個）
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={opt}
              onChange={(e) => setOpt(i, e.target.value)}
              maxLength={80}
              placeholder={`選択肢 ${i + 1}`}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            {options.length > 2 && (
              <button onClick={() => removeOpt(i)} aria-label="削除"
                style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)', display: 'flex' }}>
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < 4 && (
        <button onClick={addOpt}
          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--mm-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Plus size={15} /> 選択肢を追加
        </button>
      )}

      {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, marginTop: 14 }}>{error}</p>}

      <button onClick={submit} disabled={busy}
        style={{ marginTop: 18, width: '100%', padding: '13px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? '作成中...' : 'アンケートを公開'}
      </button>
    </div>
  )
}
