'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit, Users } from 'lucide-react'

interface Plan {
  id: string
  name: string
  description: string | null
  monthly_price: number
  benefits: string[]
  badge_emoji: string
  badge_color: string
  is_active: boolean
  member_count: number
}

const COLOR_OPTIONS = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#dc2626']
const EMOJI_OPTIONS = ['⭐', '💎', '👑', '🌸', '🔥', '💫', '🎀', '🦋']

export default function PlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pending, start] = useTransition()

  const blank = (): Plan => ({
    id: '', name: '', description: '', monthly_price: 1000, benefits: [],
    badge_emoji: '⭐', badge_color: '#a855f7', is_active: true, member_count: 0,
  })

  const save = (p: Plan) => {
    start(async () => {
      const isNew = !p.id
      const res = await fetch('/api/subscription-plan', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (res.ok) {
        setShowForm(false)
        setEditing(null)
        router.refresh()
        const j = await res.json()
        if (isNew) setPlans(prev => [...prev, { ...p, id: j.id }])
        else setPlans(prev => prev.map(x => x.id === p.id ? p : x))
      }
    })
  }

  const remove = (id: string) => {
    if (!confirm('このプランを削除しますか？既存メンバーには影響しません')) return
    start(async () => {
      const res = await fetch(`/api/subscription-plan?id=${id}`, { method: 'DELETE' })
      if (res.ok) setPlans(prev => prev.filter(p => p.id !== id))
    })
  }

  const target = editing ?? (showForm ? blank() : null)

  return (
    <>
      <button onClick={() => { setEditing(null); setShowForm(true) }} disabled={pending} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px',
        background: 'var(--mm-primary)', color: 'white', border: 'none',
        borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18,
      }}>
        <Plus size={14} />新しいプラン
      </button>

      {target && (
        <div className="mm-card" style={{ padding: 22, marginBottom: 22, border: '2px solid var(--mm-primary)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{target.id ? 'プラン編集' : '新規プラン'}</h3>
          <PlanForm plan={target} onCancel={() => { setShowForm(false); setEditing(null) }} onSave={save} pending={pending} />
        </div>
      )}

      {plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mm-text-muted)' }}>
          <p style={{ fontSize: 36, marginBottom: 10 }}>💎</p>
          <p style={{ fontSize: 13 }}>まだプランがありません</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {plans.map(p => (
            <div key={p.id} className="mm-card" style={{ padding: 18, borderTop: `4px solid ${p.badge_color}`, opacity: p.is_active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{p.badge_emoji}</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: p.badge_color }}>{p.name}</p>
                {!p.is_active && <span style={{ fontSize: 9, padding: '2px 6px', background: '#fee2e2', color: '#991b1b', borderRadius: 999 }}>非公開</span>}
              </div>
              <p style={{ fontSize: 22, fontWeight: 700 }}>¥{p.monthly_price.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--mm-text-muted)' }}>/月</span></p>
              {p.description && <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginTop: 8, lineHeight: 1.5 }}>{p.description}</p>}
              {p.benefits.length > 0 && (
                <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12, color: 'var(--mm-text-sub)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.benefits.slice(0, 5).map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--mm-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} />{p.member_count}名
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditing(p); setShowForm(false) }} style={{ background: 'transparent', border: '1px solid var(--mm-border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Edit size={11} />編集
                  </button>
                  <button onClick={() => remove(p.id)} disabled={pending} style={{ background: 'transparent', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function PlanForm({ plan, onSave, onCancel, pending }: { plan: Plan; onSave: (p: Plan) => void; onCancel: () => void; pending: boolean }) {
  const [draft, setDraft] = useState(plan)
  const [benefitText, setBenefitText] = useState(plan.benefits.join('\n'))

  const handleSave = () => {
    onSave({ ...draft, benefits: benefitText.split('\n').map(s => s.trim()).filter(Boolean) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>プラン名</label>
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} maxLength={40}
            style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>月額 (¥)</label>
          <input type="number" value={draft.monthly_price} onChange={e => setDraft({ ...draft, monthly_price: Number(e.target.value) })} min={500} step={100}
            style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13 }} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>説明</label>
        <textarea value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} maxLength={200}
          style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>特典（1行1つ）</label>
        <textarea value={benefitText} onChange={e => setBenefitText(e.target.value)} rows={4}
          placeholder="限定動画が見放題&#10;月1回の個別チャット&#10;先行販売アクセス"
          style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', display: 'block', marginBottom: 4 }}>絵文字</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setDraft({ ...draft, badge_emoji: e })} style={{
                width: 32, height: 32, fontSize: 16,
                background: draft.badge_emoji === e ? 'var(--mm-primary-light)' : 'white',
                border: draft.badge_emoji === e ? '2px solid var(--mm-primary)' : '1px solid var(--mm-border)',
                borderRadius: 6, cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', display: 'block', marginBottom: 4 }}>カラー</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setDraft({ ...draft, badge_color: c })} style={{
                width: 32, height: 32, background: c, border: draft.badge_color === c ? '3px solid black' : 'none',
                borderRadius: 6, cursor: 'pointer',
              }} />
            ))}
          </div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 'auto' }}>
          <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />
          公開
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={pending || !draft.name || draft.monthly_price < 500} style={{
          padding: '10px 20px', background: 'var(--mm-primary)', color: 'white', border: 'none',
          borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: pending ? 0.6 : 1,
        }}>保存</button>
        <button onClick={onCancel} style={{
          padding: '10px 20px', background: 'transparent', border: '1px solid var(--mm-border)',
          borderRadius: 999, fontSize: 13, cursor: 'pointer',
        }}>キャンセル</button>
      </div>
    </div>
  )
}
