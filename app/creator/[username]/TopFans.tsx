import Link from 'next/link'
import { Heart } from 'lucide-react'

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309']

export interface TopFan {
  id: string
  username: string | null
  display_name: string
  avatar_url: string | null
  total: number
  count: number
}

export default function TopFans({ fans, highlightUserId }: { fans: TopFan[]; highlightUserId?: string }) {
  if (fans.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Heart size={17} color="#ec4899" fill="#ec4899" />
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>推されランキング（TOP {fans.length}）</h2>
      </div>
      <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
        {fans.map((f, i) => {
          const isMe = highlightUserId && f.id === highlightUserId
          return (
            <div key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i === fans.length - 1 ? 'none' : '1px solid var(--mm-border)',
                background: isMe ? 'var(--mm-primary-light)' : undefined,
              }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? RANK_COLORS[i] : 'var(--mm-text-muted)', minWidth: 28 }}>
                #{i + 1}
              </span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                {f.avatar_url
                  ? <img src={f.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 14, fontWeight: 700 }}>{f.display_name[0]}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.display_name}{isMe && <span style={{ color: 'var(--mm-primary)', fontWeight: 700, marginLeft: 6 }}>（あなた）</span>}
                </p>
                <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>応援 {f.count}件</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#ec4899' }}>¥{f.total.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
