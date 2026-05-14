import { createClient } from '@/lib/supabase/server'

export type Period = 'weekly' | 'monthly' | 'all'

export function periodStart(period: Period): Date | null {
  if (period === 'all') return null
  const d = new Date()
  if (period === 'weekly') d.setDate(d.getDate() - 7)
  else d.setDate(d.getDate() - 30)
  return d
}

export interface CreatorRankRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  sales: number
  purchases: number
  followers: number
}

export async function topCreators(period: Period, limit = 20): Promise<CreatorRankRow[]> {
  const supabase = await createClient()
  const since = periodStart(period)

  const { data: creators } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .eq('role', 'creator')

  if (!creators) return []

  let purchasesQuery = supabase
    .from('purchases')
    .select('amount, content:contents!inner(creator_id)')
    .eq('status', 'completed')
  if (since) purchasesQuery = purchasesQuery.gte('created_at', since.toISOString())
  const { data: purchases } = await purchasesQuery

  const salesByCreator = new Map<string, { sales: number; purchases: number }>()
  for (const p of (purchases ?? []) as unknown as { amount: number; content: { creator_id: string } }[]) {
    const cid = p.content?.creator_id
    if (!cid) continue
    const s = salesByCreator.get(cid) ?? { sales: 0, purchases: 0 }
    s.sales += p.amount ?? 0
    s.purchases += 1
    salesByCreator.set(cid, s)
  }

  let followsQuery = supabase.from('follows').select('creator_id')
  if (since) followsQuery = followsQuery.gte('created_at', since.toISOString())
  const { data: follows } = await followsQuery

  const followersByCreator = new Map<string, number>()
  for (const f of follows ?? []) {
    followersByCreator.set(f.creator_id, (followersByCreator.get(f.creator_id) ?? 0) + 1)
  }

  return creators.map(c => ({
    ...c,
    sales: salesByCreator.get(c.id)?.sales ?? 0,
    purchases: salesByCreator.get(c.id)?.purchases ?? 0,
    followers: followersByCreator.get(c.id) ?? 0,
  })).slice(0, limit)
}

export async function trendingCreators(limit = 10): Promise<CreatorRankRow[]> {
  const supabase = await createClient()
  const now = new Date()
  const d1 = new Date(now); d1.setDate(d1.getDate() - 1)
  const d7 = new Date(now); d7.setDate(d7.getDate() - 7)

  const { data: p1 } = await supabase
    .from('purchases')
    .select('content:contents!inner(creator_id)')
    .eq('status', 'completed')
    .gte('created_at', d1.toISOString())

  const { data: p7 } = await supabase
    .from('purchases')
    .select('content:contents!inner(creator_id)')
    .eq('status', 'completed')
    .gte('created_at', d7.toISOString())

  const count24h = new Map<string, number>()
  const count7d = new Map<string, number>()
  for (const p of (p1 ?? []) as unknown as { content: { creator_id: string } }[]) {
    const cid = p.content?.creator_id
    if (cid) count24h.set(cid, (count24h.get(cid) ?? 0) + 1)
  }
  for (const p of (p7 ?? []) as unknown as { content: { creator_id: string } }[]) {
    const cid = p.content?.creator_id
    if (cid) count7d.set(cid, (count7d.get(cid) ?? 0) + 1)
  }

  const creatorIds = Array.from(count24h.keys())
  if (creatorIds.length === 0) return []

  const { data: creators } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .in('id', creatorIds)

  return (creators ?? []).map(c => {
    const c24 = count24h.get(c.id) ?? 0
    const c7 = count7d.get(c.id) ?? 0
    const daily7 = c7 / 7
    const growth = daily7 > 0 ? c24 / daily7 : c24
    return { ...c, sales: 0, purchases: c24, followers: Math.round(growth * 100) }
  }).sort((a, b) => b.followers - a.followers).slice(0, limit)
}

export async function topFans(creatorId: string, limit = 10) {
  const supabase = await createClient()
  const { data: purchases } = await supabase
    .from('purchases')
    .select('user_id, amount, tip_amount, content:contents!inner(creator_id)')
    .eq('status', 'completed')
    .eq('content.creator_id', creatorId)

  const totalByUser = new Map<string, { total: number; count: number }>()
  for (const p of (purchases ?? []) as unknown as { user_id: string; amount: number; tip_amount?: number }[]) {
    const uid = p.user_id
    const t = totalByUser.get(uid) ?? { total: 0, count: 0 }
    t.total += (p.amount ?? 0)
    t.count += 1
    totalByUser.set(uid, t)
  }

  const userIds = Array.from(totalByUser.keys())
  if (userIds.length === 0) return []

  const { data: users } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, username')
    .in('id', userIds)

  return (users ?? [])
    .map(u => ({ ...u, total: totalByUser.get(u.id)?.total ?? 0, count: totalByUser.get(u.id)?.count ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export async function userTotalSupport(userId: string): Promise<{ total: number; count: number; creators: number }> {
  const supabase = await createClient()
  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount, tip_amount, content:contents!inner(creator_id)')
    .eq('user_id', userId)
    .eq('status', 'completed')

  const rows = (purchases ?? []) as unknown as { amount: number; tip_amount?: number; content: { creator_id: string } }[]
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const creatorSet = new Set<string>()
  for (const r of rows) if (r.content?.creator_id) creatorSet.add(r.content.creator_id)
  return { total, count: rows.length, creators: creatorSet.size }
}

export async function userRankForCreator(userId: string, creatorId: string): Promise<{ rank: number; of: number } | null> {
  const fans = await topFans(creatorId, 10000)
  const of = fans.length
  const idx = fans.findIndex(f => f.id === userId)
  if (idx < 0) return null
  return { rank: idx + 1, of }
}
