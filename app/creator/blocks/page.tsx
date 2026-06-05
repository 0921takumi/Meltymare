import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Ban } from 'lucide-react'
import BlocksManager from './BlocksManager'

export const metadata: Metadata = { title: 'ブロック管理' }
export const dynamic = 'force-dynamic'

export interface BlockRow {
  id: string
  blocked_user_id: string
  reason: string | null
  created_at: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export default async function CreatorBlocksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/blocks')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/contents')

  // ブロック一覧（creator_blocks 未作成時はエラー → 空表示）
  const { data: rawBlocks, error } = await supabase
    .from('creator_blocks')
    .select('id, blocked_user_id, reason, created_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  let blocks: BlockRow[] = []
  if (!error && rawBlocks && rawBlocks.length > 0) {
    const ids = rawBlocks.map((b) => b.blocked_user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', ids)
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]))
    blocks = rawBlocks.map((b) => {
      const p = pmap.get(b.blocked_user_id)
      return {
        id: b.id,
        blocked_user_id: b.blocked_user_id,
        reason: b.reason,
        created_at: b.created_at,
        display_name: p?.display_name ?? null,
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Ban size={22} color="var(--mm-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>ブロック管理</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
          ブロックした購入者は、あなたのコンテンツを購入できなくなります。注文一覧の各注文ページからもブロックできます。
        </p>
        <BlocksManager initialBlocks={blocks} />
      </div>
    </div>
  )
}
