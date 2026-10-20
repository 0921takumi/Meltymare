import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'フォロワー一覧' }
export const dynamic = 'force-dynamic'

/** 一度に表示する最大件数。超えた分は件数を明示する（黙って切り捨てない）。 */
const PAGE_LIMIT = 500

interface FollowerRow {
  created_at: string
  follower: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

/**
 * クリエイター向け: 自分をフォローしているユーザーの一覧。
 * 依頼(2026-10): 「フォロワー一覧を見れるようにしたい」。
 *
 * follows の SELECT ポリシーは using(true)（誰でも読める）なのでセッションのクライアントで読む。
 * follows は profiles への FK が2本（follower_id / creator_id）あるため、埋め込みには
 * 必ず制約名のヒントを付ける（付けないと PGRST201 で一覧が無言で空になる）。
 * 表示するのは公開列（表示名・ID・アイコン）だけ。メールアドレス等は出さない。
 */
export default async function CreatorFollowersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/followers')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).maybeSingle()

  const [countRes, listRes] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('creator_id', user.id),
    supabase
      .from('follows')
      .select('created_at, follower:profiles!follows_follower_id_fkey(id, display_name, username, avatar_url)')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT),
  ])

  const error = countRes.error ?? listRes.error
  if (error) console.error('[creator/followers] query failed:', error.message)
  const total = countRes.count ?? 0
  const rows = ((listRes.data ?? []) as unknown as FollowerRow[]).filter(r => r.follower)
  const truncated = total > rows.length && rows.length >= PAGE_LIMIT

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/creator/dashboard" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← ダッシュボードへ</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <Users size={22} color="var(--mm-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>フォロワー</h1>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)' }}>{total.toLocaleString()}名</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginTop: 4 }}>あなたをフォローしているユーザーです（新しい順）</p>
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 13, lineHeight: 1.6, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            フォロワーを取得できませんでした。時間をおいて再度お試しください（0名ではなく取得エラーです）。
          </p>
        )}
        {truncated && (
          <p style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            {total.toLocaleString()}名のうち、新しい順に{rows.length.toLocaleString()}名を表示しています。
          </p>
        )}

        {!error && rows.length === 0 ? (
          <div className="mm-card" style={{ textAlign: 'center', padding: '56px 20px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>まだフォロワーはいません</p>
            <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>
              ダッシュボード上部の販売ページURLをSNSで共有すると、ファンがあなたをフォローできます。
            </p>
          </div>
        ) : (
          <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((r, i) => {
              const f = r.follower!
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--mm-border)' }}>
                  <Avatar src={f.avatar_url} name={f.display_name ?? ''} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.display_name || '（名前未設定）'}
                    </p>
                    {f.username && (
                      <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{f.username}</p>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(r.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}〜
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
