import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { BarChart3 } from 'lucide-react'
import PollCard from '@/components/poll/PollCard'
import { getVoteCounts } from '@/lib/polls'

export const metadata: Metadata = {
  title: 'アンケート',
  description: 'クリエイターからのアンケートに投票しよう。',
}
export const dynamic = 'force-dynamic'

export default async function PollsFeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username, role, avatar_url, identity_status')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const { data: rawPolls, error } = await supabase
    .from('polls')
    .select('id, question, options, status, created_at, creator:profiles(display_name, username, avatar_url)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(30)

  const polls = !error && rawPolls ? rawPolls : []

  const optionCounts: Record<string, number> = {}
  for (const p of polls) optionCounts[p.id] = Array.isArray(p.options) ? p.options.length : 0
  const counts = await getVoteCounts(optionCounts)

  const myVotes: Record<string, number> = {}
  if (user && polls.length > 0) {
    const { data: votes } = await supabase
      .from('poll_votes')
      .select('poll_id, option_index')
      .eq('user_id', user.id)
      .in('poll_id', polls.map((p) => p.id))
    for (const v of votes ?? []) myVotes[v.poll_id] = v.option_index
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--mm-text-sub)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
            POLLS
          </p>
          <h1 className="font-serif-display" style={{ fontSize: 30, fontWeight: 500, color: 'var(--mm-ink)' }}>アンケート</h1>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 4 }}>
            クリエイターからの質問に投票しよう。
          </p>
        </div>

        {polls.length === 0 ? (
          <div className="mm-card" style={{ textAlign: 'center', padding: 'clamp(40px,7vw,64px) 24px', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', top: 16, left: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, left: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, right: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mm-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
              NO OPEN POLLS
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)', display: 'inline-block' }} />
            </p>
            <p className="font-serif-display" style={{ fontStyle: 'italic', fontSize: 22, color: 'var(--mm-ink)', marginBottom: 12 }}>Nothing on the ballot.</p>
            <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginBottom: 24 }}>クリエイターをフォローすると、新しいアンケートのお知らせが届きます。</p>
            <Link href="/creators" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--mm-ink)', color: 'white', padding: '12px 24px', borderRadius: 999, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              クリエイターを探す →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {polls.map((p) => {
              // PostgREST埋め込みは型上は配列だが、forward FK は実行時は単一オブジェクト。両対応で正規化。
              const cr = p.creator as unknown
              const creator = (Array.isArray(cr) ? cr[0] : cr) ?? null
              return (
                <PollCard
                  key={p.id}
                  poll={{ id: p.id, question: p.question, options: (p.options ?? []) as string[], status: p.status === 'closed' ? 'closed' : 'open', creator }}
                  counts={counts[p.id] ?? []}
                  userVotedIndex={myVotes[p.id] ?? null}
                  isLoggedIn={!!user}
                  showCreator
                />
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
