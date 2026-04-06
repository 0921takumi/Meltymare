import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ContentCard from '@/components/ui/ContentCard'
import { createClient } from '@/lib/supabase/server'
import { Lock, ImageIcon, VideoIcon, Star, Users, Package, TrendingUp } from 'lucide-react'

const STATS = [
  { icon: Users,      value: '1,240+', label: '会員数' },
  { icon: Star,       value: '18',     label: '在籍クリエイター' },
  { icon: Package,    value: '420+',   label: 'コンテンツ数' },
  { icon: TrendingUp, value: '4.9',    label: '平均満足度' },
]

const HOW_TO = [
  { step: '01', icon: '📝', title: '無料で会員登録',         desc: 'メールアドレスだけで30秒登録。クレカ登録は購入時のみでOK。' },
  { step: '02', icon: '🔍', title: '好きなクリエイターを探す', desc: 'クリエイター一覧やコンテンツ一覧から気になる子をチェック。' },
  { step: '03', icon: '💳', title: 'カードで安全に購入',     desc: 'Stripe決済で安心。購入後はクリエイターがメッセージを書き込んでお届け。' },
]

const CREATOR_COLORS = [
  { bg: '#e8b4c8', text: '#8b2252' },
  { bg: '#b4d4e8', text: '#1a5276' },
  { bg: '#c8e8b4', text: '#1e5631' },
  { bg: '#e8d4b4', text: '#7d4e12' },
  { bg: '#d4b4e8', text: '#512e5f' },
  { bg: '#e8e4b4', text: '#7d6608' },
]

export default async function HomePage() {
  const supabase = await createClient()

  // ログイン状態
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  // クリエイター一覧（最大6名）
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, bio')
    .eq('role', 'creator')
    .limit(6)

  // コンテンツ一覧（最新8件）
  const { data: contents } = await supabase
    .from('contents')
    .select('*, creator:profiles(id, display_name, avatar_url)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(8)

  // 購入済みIDリスト
  let purchasedIds: string[] = []
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('content_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
    purchasedIds = purchases?.map(p => p.content_id) ?? []
  }

  // クリエイターごとのコンテンツ数
  const creatorContentCounts: Record<string, number> = {}
  if (creators && contents) {
    for (const c of creators) {
      const { count } = await supabase
        .from('contents')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', c.id)
        .eq('is_published', true)
      creatorContentCounts[c.id] = count ?? 0
    }
  }

  // 特集バナー取得
  const { data: banners } = await supabase
    .from('featured_banners')
    .select('*, creator:profiles(id, display_name, username, avatar_url), content:contents(id, title, thumbnail_url)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(5)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      {/* ━━━ HERO ━━━ */}
      <section className="mm-hero" style={{
        background: 'linear-gradient(135deg, #1a2f4a 0%, #2d6a9f 55%, #6aaad4 100%)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 20, padding: '4px 14px', marginBottom: 24 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em', fontWeight: 600 }}>
              ✦ 会員数1,240名突破
            </span>
          </div>
          <h1 className="mm-hero" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600,
            color: 'white', letterSpacing: '0.1em', marginBottom: 16, lineHeight: 1.1, padding: 0 }}>MyFocus</h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.88)', marginBottom: 8, lineHeight: 1.8, fontWeight: 500 }}>
            クリエイターの限定写真・動画を購入できるプラットフォーム
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 44, letterSpacing: '0.03em' }}>
            メッセージを書き込んだ特別な一枚 ― あなただけへ届ける
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contents" style={{ background: 'white', color: 'var(--mm-primary)',
              padding: '15px 36px', borderRadius: 10, fontWeight: 700, fontSize: 15,
              textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>コンテンツを見る</Link>
            <Link href="/auth/signup" style={{ background: 'rgba(255,255,255,0.12)', color: 'white',
              padding: '15px 36px', borderRadius: 10, fontWeight: 600, fontSize: 15,
              textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)' }}>無料登録（30秒）</Link>
          </div>
        </div>
      </section>

      {/* ━━━ STATS ━━━ */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--mm-border)' }}>
        <div className="mm-stats-grid" style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} style={{ padding: '20px 16px', textAlign: 'center', borderRight: '1px solid var(--mm-border)' }}>
              <Icon size={18} color="var(--mm-primary)" style={{ marginBottom: 6, display: 'inline-block' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--mm-primary)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ 特集バナー ━━━ */}
      {banners && banners.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em' }}>✦ FEATURED</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: banners.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {(banners as any[]).map((b: any) => {
              const href = b.link_url ?? (b.content_id ? `/contents/${b.content_id}` : b.creator?.username ? `/creator/${b.creator.username}` : '#')
              return (
                <Link key={b.id} href={href} style={{ textDecoration: 'none' }}>
                  <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #2d6a9f, #7c3aed)', minHeight: 120, display: 'flex', alignItems: 'flex-end', padding: 20, boxShadow: '0 4px 20px rgba(45,106,159,0.3)' }}>
                    {b.content?.thumbnail_url && (
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${b.content.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.25 }} />
                    )}
                    <div style={{ position: 'relative', flex: 1 }}>
                      <p style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4, lineHeight: 1.3 }}>{b.title}</p>
                      {b.subtitle && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{b.subtitle}</p>}
                      {b.creator && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {b.creator.avatar_url ? <img src={b.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{b.creator.display_name}</span>
                        </div>
                      )}
                    </div>
                    <span style={{ position: 'relative', fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700, flexShrink: 0 }}>→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ━━━ 人気クリエイター ━━━ */}
      {creators && creators.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em', marginBottom: 6 }}>CREATOR</p>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>人気のクリエイター</h2>
            </div>
            <Link href="/contents" style={{ fontSize: 13, color: 'var(--mm-primary)', textDecoration: 'none', fontWeight: 600 }}>全員を見る →</Link>
          </div>
          <div className="mm-cast-grid">
            {creators.map((creator, i) => {
              const color = CREATOR_COLORS[i % CREATOR_COLORS.length]
              const count = creatorContentCounts[creator.id] ?? 0
              return (
                <Link key={creator.id} href={`/creator/${creator.username}`} style={{ textDecoration: 'none' }}>
                  <div className="mm-card" style={{ padding: '20px 16px', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                      <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                        background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 700, color: color.text, margin: '0 auto',
                        border: '3px solid white', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                        {creator.avatar_url
                          ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : creator.display_name[0]}
                      </div>
                      {i === 0 && (
                        <span style={{ position: 'absolute', top: -4, right: -8, background: '#f59e0b', color: 'white',
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>人気No.1</span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', marginBottom: 2 }}>{creator.display_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 8 }}>@{creator.username}</p>
                    <p style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600 }}>📦 {count}件</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ━━━ 新着コンテンツ ━━━ */}
      {contents && contents.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em', marginBottom: 6 }}>CONTENTS</p>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>新着コンテンツ</h2>
            </div>
            <Link href="/contents" style={{ fontSize: 13, color: 'var(--mm-primary)', textDecoration: 'none', fontWeight: 600 }}>もっと見る →</Link>
          </div>
          <div className="mm-content-grid">
            {contents.map((content: any) => (
              <ContentCard
                key={content.id}
                content={content}
                isPurchased={purchasedIds.includes(content.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ━━━ HOW TO ━━━ */}
      <section style={{ maxWidth: 900, margin: '64px auto 0', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em', marginBottom: 8 }}>HOW TO</p>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>ご利用の流れ</h2>
        </div>
        <div className="mm-howto-grid">
          {HOW_TO.map((step, i) => (
            <div key={i} className="mm-card" style={{ padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 600,
                color: 'var(--mm-primary-light)', position: 'absolute', top: 12, right: 16, lineHeight: 1 }}>{step.step}</span>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{step.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ 安心ポイント ━━━ */}
      <section style={{ maxWidth: 900, margin: '60px auto 0', padding: '0 24px' }}>
        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 16, padding: '36px 32px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 28 }}>🔒 安心・安全のプラットフォーム</h2>
          <div className="mm-trust-grid">
            {[
              { icon: '🛡️', text: 'Stripe認定の安全決済' },
              { icon: '🙈', text: '閲覧履歴は完全非公開' },
              { icon: '✍️', text: '手書きメッセージ付き納品' },
              { icon: '💬', text: '24時間サポート対応' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-text-sub)' }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ BOTTOM CTA ━━━ */}
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a2f4a 0%, #2d6a9f 100%)',
          borderRadius: 20, padding: '56px 24px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 34, fontWeight: 600,
            color: 'white', marginBottom: 12, letterSpacing: '0.05em' }}>今すぐ始める</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 32 }}>
            無料登録するだけ。購入しなくてもコンテンツ一覧は見られます。
          </p>
          <Link href="/auth/signup" style={{ display: 'inline-block', background: 'white', color: 'var(--mm-primary)',
            padding: '16px 48px', borderRadius: 10, fontWeight: 700, fontSize: 16,
            textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
            無料で会員登録
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
