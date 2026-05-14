import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { analyzeAnswers } from '@/lib/diagnosis'
import { Sparkles, RefreshCw } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CARD_COLORS = [
  { bg: '#e8b4c8', text: '#8b2252' }, { bg: '#b4d4e8', text: '#1a5276' },
  { bg: '#c8e8b4', text: '#1e5631' }, { bg: '#e8d4b4', text: '#7d4e12' },
  { bg: '#d4b4e8', text: '#512e5f' },
]

export default async function DiagnosisResultPage({
  searchParams,
}: {
  searchParams: Promise<{ tags?: string; vibe?: string }>
}) {
  const { tags: tagsParam = '', vibe = '' } = await searchParams
  const selectedTags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  const answerTagSets: string[][] = [vibe ? [vibe] : [], ...selectedTags.slice(1).map(t => [t])]
  const result = analyzeAnswers(answerTagSets.length ? answerTagSets : [selectedTags])

  const { data: contents } = await supabase
    .from('contents')
    .select('id, title, tags, price, thumbnail_url, creator_id, sold_count, creator:profiles(id, display_name, username, avatar_url, bio)')
    .eq('is_published', true)

  const scoreByCreator = new Map<string, { score: number; creator: any; hitTags: Set<string>; contentCount: number; totalSold: number }>()

  ;(contents ?? []).forEach((c: any) => {
    const contentTags: string[] = Array.isArray(c.tags) ? c.tags : []
    let hit = 0
    const hitTags = new Set<string>()
    for (const t of selectedTags) {
      if (contentTags.some(ct => ct.includes(t) || t.includes(ct))) {
        hit += 1
        hitTags.add(t)
      }
    }
    if (!c.creator) return
    const cid = c.creator_id
    const entry = scoreByCreator.get(cid) ?? { score: 0, creator: c.creator, hitTags: new Set<string>(), contentCount: 0, totalSold: 0 }
    entry.score += hit
    hitTags.forEach(t => entry.hitTags.add(t))
    entry.contentCount += 1
    entry.totalSold += c.sold_count ?? 0
    scoreByCreator.set(cid, entry)
  })

  let ranked = Array.from(scoreByCreator.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.totalSold - a.totalSold
  })

  if (ranked.length < 5) {
    const { data: allCreators } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, bio')
      .eq('role', 'creator')
      .limit(10)
    const existingIds = new Set(ranked.map(r => r.creator.id))
    ;(allCreators ?? []).forEach(c => {
      if (!existingIds.has(c.id)) {
        ranked.push({ score: 0, creator: c, hitTags: new Set<string>(), contentCount: 0, totalSold: 0 })
      }
    })
  }

  const top = ranked.slice(0, 5)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fff5f8 0%, #f4eef8 100%)' }}>
      <Header user={profile} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>

        {/* Result card */}
        <div style={{ background: 'white', borderRadius: 24, padding: '36px 28px', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.18em', marginBottom: 12 }}>
            YOUR OSHI TYPE
          </p>
          <div style={{ fontSize: 72, marginBottom: 6 }}>{result.personalityEmoji}</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, background: 'linear-gradient(135deg, var(--mm-primary) 0%, #d946ef 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {result.personalityLabel}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8, maxWidth: 460, margin: '0 auto' }}>
            {result.personalityDescription}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 20 }}>
            {Array.from(new Set(selectedTags)).slice(0, 8).map((t, i) => (
              <span key={i} style={{ fontSize: 11, background: 'rgba(217,70,239,0.08)', color: '#a21caf', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* Recommended creators */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Sparkles size={17} color="#d946ef" />
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>あなたにおすすめのクリエイター TOP5</h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginLeft: 25 }}>
            回答をもとにタグマッチングで算出
          </p>
        </div>

        {top.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 16, color: 'var(--mm-text-muted)' }}>
            まだクリエイターが登録されていません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {top.map((r, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length]
              return (
                <Link key={r.creator.id} href={`/creator/${r.creator.username}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', borderRadius: 16, padding: '18px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    border: i === 0 ? '2px solid #d946ef' : '1px solid var(--mm-border)',
                    boxShadow: i === 0 ? '0 8px 24px rgba(217,70,239,0.18)' : '0 2px 8px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}>
                    {i === 0 && (
                      <span style={{ position: 'absolute', top: -10, left: 16, background: 'linear-gradient(135deg, var(--mm-primary), #d946ef)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                        👑 BEST MATCH
                      </span>
                    )}
                    <div style={{
                      fontSize: 24, fontWeight: 800, fontFamily: 'Cormorant Garamond, serif',
                      color: i === 0 ? '#d946ef' : 'var(--mm-text-muted)', minWidth: 32,
                    }}>#{i + 1}</div>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: color.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: color.text, flexShrink: 0 }}>
                      {r.creator.avatar_url
                        ? <img src={r.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : r.creator.display_name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{r.creator.display_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>@{r.creator.username}</p>
                      {r.hitTags.size > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Array.from(r.hitTags).slice(0, 4).map((t, ti) => (
                            <span key={ti} style={{ fontSize: 10, background: 'rgba(217,70,239,0.1)', color: '#a21caf', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#d946ef' }}>{r.score > 0 ? Math.min(99, 60 + r.score * 8) : 50}%</p>
                      <p style={{ fontSize: 9, color: 'var(--mm-text-muted)', fontWeight: 600 }}>MATCH</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 36, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/diagnosis" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white',
            color: 'var(--mm-text)', border: '1px solid var(--mm-border)',
            padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>
            <RefreshCw size={13} /> もう一度診断する
          </Link>
          <Link href="/creators" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--mm-primary)', color: 'white',
            padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            全クリエイターを見る
          </Link>
        </div>

      </div>
    </div>
  )
}
