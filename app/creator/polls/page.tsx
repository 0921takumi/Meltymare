import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BarChart3 } from 'lucide-react'
import PollCreator from '@/components/poll/PollCreator'
import CreatorPollList, { type ManagedPoll } from '@/components/poll/CreatorPollList'
import { getVoteCounts } from '@/lib/polls'

export const metadata: Metadata = { title: 'アンケート管理' }
export const dynamic = 'force-dynamic'

export default async function CreatorPollsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/creator/polls')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') redirect('/contents')

  const { data: rawPolls, error } = await supabase
    .from('polls')
    .select('id, question, options, status, created_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  let polls: ManagedPoll[] = []
  if (!error && rawPolls) {
    const optionCounts: Record<string, number> = {}
    for (const p of rawPolls) optionCounts[p.id] = Array.isArray(p.options) ? p.options.length : 0
    const counts = await getVoteCounts(optionCounts)
    polls = rawPolls.map((p) => ({
      id: p.id,
      question: p.question,
      options: (p.options ?? []) as string[],
      status: p.status === 'closed' ? 'closed' : 'open',
      counts: counts[p.id] ?? [],
    }))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />
      <div className="mm-page-pad" style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <BarChart3 size={22} color="var(--mm-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>アンケート</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
          ファンに質問して投票してもらえます（選択肢は最大4つ）。結果は集計で表示され、誰が選んだかは表示されません。
        </p>

        <div style={{ marginBottom: 28 }}>
          <PollCreator />
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text-sub)', marginBottom: 14 }}>公開中・過去のアンケート</h2>
        <CreatorPollList initialPolls={polls} />
      </div>
    </div>
  )
}
