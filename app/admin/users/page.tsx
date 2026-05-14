import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, AlertCircle } from 'lucide-react'
import UserActions from './UserActions'

export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url: string | null
  role: 'user' | 'creator' | 'admin'
  identity_status: string | null
  is_suspended: boolean
  suspended_reason: string | null
  created_at: string
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const role = sp.role ?? 'all'
  const q = sp.q ?? ''

  let query = supabase
    .from('profiles')
    .select('id, email, username, display_name, avatar_url, role, identity_status, is_suspended, suspended_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (role !== 'all') query = query.eq('role', role)
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`)

  const { data } = await query
  const users = (data ?? []) as UserRow[]

  // 各ユーザーの購入数 / 売上
  const ids = users.map(u => u.id)
  const purchaseStats = new Map<string, { count: number; total: number }>()
  if (ids.length > 0) {
    const { data: purchases } = await supabase.from('purchases').select('user_id, amount, tip_amount').in('user_id', ids).eq('status', 'completed')
    for (const p of purchases ?? []) {
      const s = purchaseStats.get(p.user_id) ?? { count: 0, total: 0 }
      s.count++
      s.total += (p.amount ?? 0) + (p.tip_amount ?? 0)
      purchaseStats.set(p.user_id, s)
    }
  }

  return (
    <div className="admin-page">
      <h1 className="admin-h1">ユーザー管理</h1>
      <p className="admin-h1-sub" style={{ marginBottom: 22 }}>すべてのアカウント / 凍結処理</p>

      {/* フィルタ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'すべて' },
          { key: 'user', label: 'ユーザー' },
          { key: 'creator', label: 'クリエイター' },
          { key: 'admin', label: '管理者' },
        ].map(t => (
          <Link key={t.key} href={`/admin/users?role=${t.key}${q ? `&q=${q}` : ''}`} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: role === t.key ? 'var(--mm-primary)' : 'white',
            color: role === t.key ? 'white' : 'var(--mm-text-sub)',
            border: role === t.key ? 'none' : '1px solid var(--mm-border)',
            textDecoration: 'none',
          }}>{t.label}</Link>
        ))}
      </div>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input type="hidden" name="role" value={role} />
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)' }} />
          <input name="q" defaultValue={q} placeholder="名前・メール・username で検索"
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13 }} />
        </div>
      </form>

      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>{users.length}名（最新200件）</p>

      <div className="mm-card" style={{ overflow: 'hidden' }}>
        <div className="mm-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--mm-bg)' }}>
                {['ユーザー', 'ロール', '購入数', '累計支援', '本人確認', 'ステータス', '登録日', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const stat = purchaseStats.get(u.id) ?? { count: 0, total: 0 }
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--mm-border)', opacity: u.is_suspended ? 0.5 : 1 }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                          {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{u.display_name}</p>
                          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>@{u.username} · {u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: u.role === 'admin' ? '#fef3c7' : u.role === 'creator' ? '#ede9fe' : '#dbeafe',
                        color: u.role === 'admin' ? '#92400e' : u.role === 'creator' ? '#7c3aed' : '#1e40af',
                      }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{stat.count}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669' }}>¥{stat.total.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {u.role === 'creator' && u.identity_status ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: u.identity_status === 'approved' ? '#d1fae5' : u.identity_status === 'pending' ? '#fef3c7' : '#fee2e2',
                          color: u.identity_status === 'approved' ? '#065f46' : u.identity_status === 'pending' ? '#92400e' : '#991b1b',
                        }}>{u.identity_status === 'approved' ? '承認' : u.identity_status === 'pending' ? '審査中' : u.identity_status === 'rejected' ? '却下' : '—'}</span>
                      ) : <span style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {u.is_suspended ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={9} />凍結
                        </span>
                      ) : <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>正常</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--mm-text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <UserActions user={u} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
