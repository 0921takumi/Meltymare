import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <BarChart3 size={22} color="var(--mm-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>アンケート</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 24 }}>
          クリエイターからの質問に投票しよう。
        </p>

        {polls.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '70vh', textAlign: 'center', color: 'var(--mm-text-muted)',
          }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>現在公開中のアンケートはありません。</p>
            <p style={{ fontSize: 12 }}>クリエイターをフォローすると、新しいアンケートの通知が届きます。</p>
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
