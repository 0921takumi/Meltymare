'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Send, Sparkles } from 'lucide-react'

interface ChatMsg {
  id: string
  body: string
  is_super_chat: boolean
  super_chat_amount: number | null
  created_at: string
  user: { id: string; display_name: string; avatar_url: string | null } | null
}

export default function LiveChat({ streamId, initialMessages, currentUserId, isOwner, isLive }: {
  streamId: string
  initialMessages: ChatMsg[]
  currentUserId: string | null
  isOwner: boolean
  isLive: boolean
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages)
  const [text, setText] = useState('')
  const [isSuper, setIsSuper] = useState(false)
  const [amount, setAmount] = useState(500)
  const [pending, start] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages])

  const send = () => {
    if (!text.trim() || !currentUserId) return
    start(async () => {
      const res = await fetch('/api/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: streamId,
          body: text,
          is_super_chat: isSuper,
          super_chat_amount: isSuper ? amount : null,
        }),
      })
      if (res.ok) {
        const j = await res.json()
        setMessages(prev => [...prev, j.message])
        setText('')
        setIsSuper(false)
      }
    })
  }

  return (
    <>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', textAlign: 'center', marginTop: 30 }}>まだコメントがありません</p>
        ) : messages.map(m => (
          <div key={m.id} style={{
            padding: m.is_super_chat ? '8px 12px' : 0,
            background: m.is_super_chat ? 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)' : 'transparent',
            borderRadius: m.is_super_chat ? 8 : 0,
            border: m.is_super_chat ? '1px solid #fbbf24' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0 }}>
                {m.user?.avatar_url ? <img src={m.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, color: m.is_super_chat ? '#92400e' : 'var(--mm-text-sub)' }}>{m.user?.display_name ?? '匿名'}</p>
              {m.is_super_chat && (
                <span style={{ fontSize: 10, color: '#92400e', fontWeight: 700, background: 'white', padding: '1px 6px', borderRadius: 999 }}>¥{m.super_chat_amount?.toLocaleString()}</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--mm-text)', marginLeft: 28, marginTop: 2, wordBreak: 'break-word' }}>{m.body}</p>
          </div>
        ))}
      </div>

      {currentUserId && isLive ? (
        <div style={{ padding: 12, borderTop: '1px solid var(--mm-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mm-text-sub)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isSuper} onChange={e => setIsSuper(e.target.checked)} />
              <Sparkles size={12} color="#f59e0b" />スーパーチャット
            </label>
            {isSuper && (
              <select value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ padding: '3px 6px', fontSize: 11, borderRadius: 4 }}>
                <option value={100}>¥100</option>
                <option value={500}>¥500</option>
                <option value={1000}>¥1,000</option>
                <option value={3000}>¥3,000</option>
                <option value={5000}>¥5,000</option>
                <option value={10000}>¥10,000</option>
              </select>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="コメント…"
              maxLength={200}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--mm-border)', borderRadius: 999, fontSize: 12 }}
            />
            <button onClick={send} disabled={pending || !text.trim()} style={{ padding: '0 14px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 999, cursor: 'pointer' }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : !isLive ? (
        <div style={{ padding: 12, borderTop: '1px solid var(--mm-border)', fontSize: 11, color: 'var(--mm-text-muted)', textAlign: 'center' }}>配信中のみコメント可能</div>
      ) : (
        <div style={{ padding: 12, borderTop: '1px solid var(--mm-border)', fontSize: 11, color: 'var(--mm-text-muted)', textAlign: 'center' }}>ログインするとコメントできます</div>
      )}
      {isOwner && <div style={{ padding: '6px 12px', background: '#fef9c3', fontSize: 10, color: '#92400e', textAlign: 'center', borderTop: '1px solid var(--mm-border)' }}>あなたが配信者です</div>}
    </>
  )
}
