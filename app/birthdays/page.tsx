import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Cake, Gift } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'バースデー' }
export const dynamic = 'force-dynamic'

interface CreatorRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  birthdate: string | null
  birthday_public: boolean
}

function birthdayInfo(birthdate: string): { month: number; day: number; daysUntil: number; isToday: boolean; ageNext: number } {
  const d = new Date(birthdate)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const now = new Date()
  const thisYear = now.getFullYear()
  let next = new Date(thisYear, d.getMonth(), d.getDate())
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(thisYear + 1, d.getMonth(), d.getDate())
  const daysUntil = Math.ceil((next.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
  const isToday = next.toDateString() === new Date().toDateString()
  const ageNext = next.getFullYear() - d.getFullYear()
  return { month, day, daysUntil, isToday, ageNext }
}

export default async function BirthdaysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).single() : { data: null }

  const { data: creatorsData } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, birthdate, birthday_public')
    .eq('role', 'creator')
    .eq('birthday_public', true)
    .not('birthdate', 'is', null)

  const creators = (creatorsData ?? []) as CreatorRow[]

  // 今月 / 来月 / 今日 で分類
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1

  const today: (CreatorRow & { info: ReturnType<typeof birthdayInfo> })[] = []
  const thisMonthList: (CreatorRow & { info: ReturnType<typeof birthdayInfo> })[] = []
  const nextMonthList: (CreatorRow & { info: ReturnType<typeof birthdayInfo> })[] = []
  const upcoming: (CreatorRow & { info: ReturnType<typeof birthdayInfo> })[] = []

  for (const c of creators) {
    if (!c.birthdate) continue
    const info = birthdayInfo(c.birthdate)
    const item = { ...c, info }
    if (info.isToday) today.push(item)
    else if (info.month === thisMonth) thisMonthList.push(item)
    else if (info.month === nextMonth) nextMonthList.push(item)
    else upcoming.push(item)
  }

  thisMonthList.sort((a, b) => a.info.day - b.info.day)
  nextMonthList.sort((a, b) => a.info.day - b.info.day)
  upcoming.sort((a, b) => a.info.daysUntil - b.info.daysUntil)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      {/* ヒーロー */}
      <div style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #fef3c7 100%)', padding: '40px 20px 56px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎂</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#831843' }}>バースデー</h1>
        <p style={{ fontSize: 13, color: '#9f1239', marginTop: 6 }}>推しのお誕生日をみんなでお祝いしよう</p>
      </div>

      <div className="mm-page-pad" style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* 本日が誕生日 */}
        {today.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Cake size={20} color="#ec4899" />
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>🎉 本日が誕生日</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {today.map(c => (
                <BirthdayCard key={c.id} creator={c} highlight />
              ))}
            </div>
          </section>
        )}

        {/* 今月の誕生日 */}
        {thisMonthList.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Gift size={18} color="#f59e0b" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{thisMonth}月生まれ</h2>
              <span style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginLeft: 4 }}>{thisMonthList.length}名</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {thisMonthList.map(c => (
                <BirthdayCard key={c.id} creator={c} />
              ))}
            </div>
          </section>
        )}

        {/* 来月 */}
        {nextMonthList.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--mm-text-sub)' }}>{nextMonth}月生まれ</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {nextMonthList.map(c => (
                <BirthdayCard key={c.id} creator={c} compact />
              ))}
            </div>
          </section>
        )}

        {/* 今後 */}
        {upcoming.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--mm-text-sub)' }}>今後の誕生日</h2>
            <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
              {upcoming.slice(0, 20).map((c, i) => (
                <Link key={c.id} href={`/creator/${c.username}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < Math.min(19, upcoming.length - 1) ? '1px solid var(--mm-border)' : 'none',
                  textDecoration: 'none',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0 }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{c.info.month}月{c.info.day}日</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#ec4899', fontWeight: 700, flexShrink: 0 }}>あと{c.info.daysUntil}日</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {creators.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--mm-text-muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🎈</p>
            <p style={{ fontSize: 14 }}>誕生日を公開しているクリエイターがまだいません</p>
          </div>
        )}

      </div>
    </div>
  )
}

function BirthdayCard({ creator, highlight, compact }: { creator: CreatorRow & { info: ReturnType<typeof birthdayInfo> }; highlight?: boolean; compact?: boolean }) {
  return (
    <Link href={`/creator/${creator.username}`} className="mm-card" style={{
      padding: compact ? 12 : 16,
      display: 'flex', alignItems: 'center', gap: 12,
      textDecoration: 'none',
      background: highlight ? 'linear-gradient(135deg, #fdf2f8 0%, white 70%)' : 'white',
      border: highlight ? '2px solid #fbcfe8' : undefined,
      position: 'relative',
    }}>
      {highlight && (
        <span style={{ position: 'absolute', top: -10, left: 12, background: '#ec4899', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.05em' }}>
          🎉 TODAY
        </span>
      )}
      <div style={{ width: compact ? 44 : 56, height: compact ? 44 : 56, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0, border: highlight ? '3px solid white' : undefined }}>
        {creator.avatar_url ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 20 }}>👤</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: 'var(--mm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creator.display_name}</p>
        <p style={{ fontSize: 12, color: highlight ? '#ec4899' : 'var(--mm-text-muted)', fontWeight: highlight ? 700 : 400, marginTop: 2 }}>
          🎂 {creator.info.month}月{creator.info.day}日
          {!highlight && <span style={{ marginLeft: 6, color: 'var(--mm-text-muted)' }}>（あと{creator.info.daysUntil}日）</span>}
        </p>
      </div>
    </Link>
  )
}
