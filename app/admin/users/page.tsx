import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Search, AlertCircle } from 'lucide-react'
import UserActions from './UserActions'
import Avatar from '@/components/ui/Avatar'

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
  // v22: email / is_suspended / suspended_reason（PII）は service_role で読む。
  // 認可は app/admin/layout.tsx が admin に限定済み。
  const admin = createAdminClient()
  const role = sp.role ?? 'all'
  const q = sp.q ?? ''

  let query = admin
    .from('profiles')
    .select('id, email, username, display_name, avatar_url, role, identity_status, is_suspended, suspended_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (role !== 'all') query = query.eq('role', role)
  if (q) {
    // PostgREST フィルタ注入対策：構文上意味のある文字（%,():*"\）を除去し長さ制限する
    const safeQ = q.replace(/[%,():*"\\]/g, '').trim().slice(0, 100)
    if (safeQ) query = query.or(`display_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,username.ilike.%${safeQ}%`)
  }

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
      s.total += (p.amount ?? 0)  // amount はチップ込みのため tip_amount を再加算しない
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
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
          <input name="q" defaultValue={q} placeholder="名前・メール・username で検索"
            className="admin-input"
            style={{ paddingLeft: 36 }} />
        </div>
      </form>

      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 12 }}>{users.length}名（最新200件）</p>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th>ユーザー</th>
              <th>ロール</th>
              <th className="num">購入数</th>
              <th className="num">累計支援</th>
              <th>本人確認</th>
              <th>ステータス</th>
              <th>登録日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const stat = purchaseStats.get(u.id) ?? { count: 0, total: 0 }
              return (
                <tr key={u.id} style={{ opacity: u.is_suspended ? 0.55 : 1 }}>
                  <td data-label="ユーザー">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar src={u.avatar_url} name={u.display_name} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, color: 'var(--mm-ink)' }}>{u.display_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>@{u.username} · {u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td data-label="ロール">
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: u.role === 'admin' ? '#fef3c7' : u.role === 'creator' ? 'var(--mm-primary-light)' : 'var(--mm-accent-light)',
                      color: u.role === 'admin' ? '#92400e' : u.role === 'creator' ? 'var(--mm-primary)' : 'var(--mm-accent)',
                    }}>{u.role}</span>
                  </td>
                  <td data-label="購入数" className="num" style={{ fontWeight: 700 }}>{stat.count}</td>
                  <td data-label="累計支援" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>¥{stat.total.toLocaleString()}</td>
                  <td data-label="本人確認">
                    {/* 以前はクリエイターの行にしか状態を出しておらず、一般ユーザーは常に「—」だった。
                        クリエイターへの昇格には本人確認の承認が必須なので、昇格前の一般ユーザーこそ見える必要がある。 */}
                    {u.role === 'admin' ? (
                      <span style={{ fontSize: 10, color: 'var(--mm-text-muted)' }}>—</span>
                    ) : (() => {
                      const s = u.identity_status ?? 'unsubmitted'
                      const meta = s === 'approved' ? { label: '承認', bg: '#d1fae5', fg: '#065f46' }
                        : s === 'pending' ? { label: '審査待ち', bg: '#fef3c7', fg: '#92400e' }
                        : s === 'rejected' ? { label: '却下', bg: '#fee2e2', fg: '#991b1b' }
                        : { label: '未提出', bg: '#f1f5f9', fg: '#334155' }
                      return (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}>
                          {meta.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td data-label="ステータス">
                    {u.is_suspended ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={10} />凍結
                      </span>
                    ) : <span style={{ fontSize: 10, color: '#065f46', fontWeight: 700, padding: '3px 9px', background: '#d1fae5', borderRadius: 999 }}>正常</span>}
                  </td>
                  <td data-label="登録日" style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(u.created_at).toLocaleDateString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric' })}
                  </td>
                  <td data-label="操作">
                    <UserActions user={u} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
