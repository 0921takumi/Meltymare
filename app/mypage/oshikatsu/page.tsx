import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, Heart, Calendar, Award } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '推し活記録' }
export const dynamic = 'force-dynamic'

interface PurchaseRow {
  id: string
  amount: number
  tip_amount: number | null
  created_at: string
  content: {
    id: string
    title: string
    thumbnail_url: string | null
    creator: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  } | null
}

interface FollowRow {
  created_at: string
  creator: { id: string; display_name: string; username: string; avatar_url: string | null; bio: string | null } | null
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

export default async function OshikatsuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/mypage/oshikatsu')

  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()

  // 購入履歴
  const { data: purchasesData } = await supabase
    .from('purchases')
    .select('id, amount, tip_amount, created_at, content:contents(id, title, thumbnail_url, creator:profiles!contents_creator_id_fkey(id, display_name, username, avatar_url))')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const purchases = (purchasesData ?? []) as unknown as PurchaseRow[]

  // フォロー履歴
  const { data: followsData } = await supabase
    .from('follows')
    .select('created_at, creator:profiles!follows_creator_id_fkey(id, display_name, username, avatar_url, bio)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: true })

  const follows = (followsData ?? []) as unknown as FollowRow[]

  // 依頼で削除: 月次支出グラフ・月平均支出・累計支援額・支援額ランキングは
  // 購入者画面から無くす方針のため、金額の集計はもう行わない（件数のみ集計する）。

  // 推し別集計（フォロー + 購入）
  type OshiAgg = {
    creator: NonNullable<FollowRow['creator']>
    followedAt: string | null
    days: number
    spent: number
    items: number
  }
  const oshiMap = new Map<string, OshiAgg>()
  for (const f of follows) {
    if (!f.creator) continue
    oshiMap.set(f.creator.id, {
      creator: f.creator,
      followedAt: f.created_at,
      days: daysSince(f.created_at),
      spent: 0,
      items: 0,
    })
  }
  for (const p of purchases) {
    const c = p.content?.creator
    if (!c) continue
    const existing = oshiMap.get(c.id)
    if (existing) {
      existing.spent += (p.amount ?? 0)
      existing.items += 1
    } else {
      oshiMap.set(c.id, {
        creator: c as NonNullable<FollowRow['creator']>,
        followedAt: null,
        days: 0,
        spent: (p.amount ?? 0),
        items: 1,
      })
    }
  }
  const oshiList = Array.from(oshiMap.values())
  const oshiByDays = [...oshiList].filter(o => o.followedAt).sort((a, b) => b.days - a.days)
  const oshiBySpent = [...oshiList].sort((a, b) => b.spent - a.spent).filter(o => o.spent > 0)

  // 1番の推し
  const numberOneOshi = oshiBySpent[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 22 }}>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>← マイページへ</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 }}>
            <Sparkles size={22} color="#ec4899" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>推し活記録</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>あなたの推しへの想いを可視化</p>
        </div>

        {/* 統計バー（依頼で金額系(月平均支出・累計支援額)を削除、件数・期間のみ表示） */}
        <div className="mm-stats-grid" style={{ marginBottom: 28, gap: 0, border: '1px solid var(--mm-border)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
          <StatCell value={`${oshiList.length}`} label="推し人数" color="#ec4899" />
          <StatCell value={`${purchases.length}`} label="購入数" color="var(--mm-primary)" />
          <StatCell value={`${oshiByDays[0]?.days ?? 0}日`} label="最長推し期間" color="#f59e0b" />
        </div>

        {/* 1番の推し（金額ではなく応援件数・推し歴で表示、依頼で¥表示を削除） */}
        {numberOneOshi && (
          <div className="mm-card" style={{ padding: '20px 22px', marginBottom: 28, background: 'linear-gradient(135deg, #fdf2f8 0%, white 70%)', border: '2px solid #fbcfe8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Award size={18} color="#ec4899" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', letterSpacing: '0.05em' }}>NUMBER ONE 推し</p>
            </div>
            <Link href={`/creator/${numberOneOshi.creator.username}`} style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', flexWrap: 'wrap' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'white', overflow: 'hidden', border: '3px solid #fbcfe8', flexShrink: 0 }}>
                {numberOneOshi.creator.avatar_url
                  ? <img src={numberOneOshi.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28 }}>👤</div>}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--mm-text)' }}>{numberOneOshi.creator.display_name}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>@{numberOneOshi.creator.username}</p>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>{numberOneOshi.items}件購入</span>
                  {numberOneOshi.followedAt && (
                    <span style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>推し歴 {numberOneOshi.days}日</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* 依頼で削除: 月次支出グラフ */}
        {/* 推し期間ランキング */}
        {oshiByDays.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Calendar size={18} color="#f59e0b" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>推し期間ランキング</h2>
            </div>
            <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
              {oshiByDays.slice(0, 10).map((o, i) => (
                <Link key={o.creator.id} href={`/creator/${o.creator.username}`} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderBottom: i < Math.min(9, oshiByDays.length - 1) ? '1px solid var(--mm-border)' : 'none',
                  textDecoration: 'none',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--mm-text-muted)', width: 28, textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                    {o.creator.avatar_url
                      ? <img src={o.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 18 }}>👤</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.creator.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                      推し歴 <strong style={{ color: '#f59e0b' }}>{o.days}日</strong>
                      {o.items > 0 && <> · {o.items}件購入</>}
                    </p>
                  </div>
                  <Heart size={14} color="#ec4899" fill="#ec4899" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {oshiList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>💗</p>
            <p style={{ fontSize: 15, marginBottom: 8 }}>まだ推しがいません</p>
            <Link href="/creators" style={{ fontSize: 14, color: 'var(--mm-primary)', fontWeight: 600 }}>クリエイターを探す →</Link>
          </div>
        )}

      </div>
    </div>
  )
}

function StatCell({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid var(--mm-border)' }}>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>{label}</p>
    </div>
  )
}
