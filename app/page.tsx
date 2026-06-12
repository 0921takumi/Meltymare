import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ContentCard from '@/components/ui/ContentCard'
import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import { PenLine, Search, CreditCard, ShieldCheck, EyeOff, PenTool, MessageCircle } from 'lucide-react'
/**
 * ヒーローのポラロイド画像 URL。
 * `null` の場合はグラデーション＋アイコンのフォールバック表示。
 * 後で AI 生成画像を `/public/hero/polaroid-*.webp` として配置する想定。
 * 画像は 4:5 縦長、暖色系がベスト。
 */
const HERO_POLAROIDS: { src: string | null; tint: string }[] = [
  { src: null, tint: 'linear-gradient(135deg, rgba(245,212,190,0.0) 0%, rgba(211,107,36,0.35) 100%)' },  // card 1: warm
  { src: null, tint: 'linear-gradient(160deg, rgba(220,237,243,0.0) 0%, rgba(37,142,172,0.4) 100%)' },   // card 2: cool
  { src: null, tint: 'linear-gradient(135deg, rgba(252,233,216,0.0) 0%, rgba(211,107,36,0.3) 100%)' },   // card 3: peach
]

const HOW_TO = [
  { step: '01', icon: PenLine,    title: '無料で会員登録',         desc: 'メールアドレスだけで30秒登録。クレカ登録は購入時のみでOK。' },
  { step: '02', icon: Search,     title: '好きなクリエイターを探す', desc: 'クリエイター一覧やコンテンツ一覧から気になる子をチェック。' },
  { step: '03', icon: CreditCard, title: 'カードで安全に購入',     desc: 'Stripe決済で安心。購入後はクリエイターがメッセージを書き込んでお届け。' },
]

// アバターのフォールバック配色: ブランドパレット由来の6トーン（紙×墨×オレンジ×ティールの世界観）
const CREATOR_COLORS = [
  { bg: '#f5d4be', text: '#8a4a18' },
  { bg: '#dcedf3', text: '#1a6c85' },
  { bg: '#fce9d8', text: '#b85a1c' },
  { bg: '#ece4d4', text: '#6b5d4a' },
  { bg: '#e3d5c0', text: '#7d5a2e' },
  { bg: '#d8e4e1', text: '#3c6e64' },
]

export default async function HomePage() {
  const supabase = await createClient()

  // ログイン状態
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).single()
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

  // クリエイターごとのコンテンツ数（N+1 を避け、1クエリで集計）
  const creatorContentCounts: Record<string, number> = {}
  if (creators && creators.length > 0) {
    const { data: countRows } = await supabase
      .from('contents')
      .select('creator_id')
      .in('creator_id', creators.map(c => c.id))
      .eq('is_published', true)
    for (const row of countRows ?? []) {
      creatorContentCounts[row.creator_id] = (creatorContentCounts[row.creator_id] ?? 0) + 1
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

      {/* ━━━ HERO (Editorial Magazine 風) ━━━
       *
       * 構成:
       *   左カラム: ISSUE バッジ → 巨大ディスプレイタイトル → 日本語サブ → CTA → メタ情報
       *   右カラム: 3枚のポラロイドが重なって浮いている。ホバーで前面に来る。
       *
       * オレンジは差し色（line / dot / eyebrow）に限定。ベースはクリーム＋ノイズ質感。
       * `mm-viewfinder-corner` はロゴのカメラ枠と呼応。
       */}
      <section className="mm-hero" style={{ background: 'var(--mm-bg)' }}>
        {/* グレイン質感（紙っぽさ） */}
        <div className="mm-grain" aria-hidden />

        {/* カメラのファインダー枠（4隅） */}
        <span className="mm-viewfinder-corner tl" aria-hidden />
        <span className="mm-viewfinder-corner tr" aria-hidden />
        <span className="mm-viewfinder-corner bl" aria-hidden />
        <span className="mm-viewfinder-corner br" aria-hidden />

        <div className="mm-hero-grid">
          {/* ── 左カラム: ロゴ主役 + コピー ───────────────────── */}
          <div className="mm-fade-in" style={{ position: 'relative', zIndex: 2 }}>
            <p className="mm-eyebrow" style={{ marginBottom: 24 }}>
              ISSUE 01 — 2026 SPRING
            </p>

            {/* ロゴをヒーローの顔に。サイズはレスポンシブ。 */}
            <Image
              src="/logo.svg"
              alt="My Focus"
              width={300}
              height={278}
              priority
              unoptimized
              style={{
                width: 'clamp(180px, 24vw, 280px)',
                height: 'auto',
                display: 'block',
                marginBottom: 28,
              }}
            />

            {/* h1 は SEO/a11y のためにバリュープロップを担う */}
            <h1 className="font-jp-serif" style={{
              fontSize: 'clamp(26px, 3.4vw, 38px)',
              fontWeight: 600,
              color: 'var(--mm-ink)',
              letterSpacing: '0.02em',
              lineHeight: 1.45,
              margin: '0 0 12px',
              maxWidth: 480,
            }}>
              推しと、もっと近く。
            </h1>

            <p className="font-jp-serif" style={{
              fontSize: 'clamp(15px, 1.5vw, 17px)',
              fontWeight: 500,
              color: 'var(--mm-text-sub)',
              letterSpacing: '0.04em',
              lineHeight: 1.85,
              margin: '0 0 22px',
              maxWidth: 460,
            }}>
              手紙のような、写真のような<span style={{ color: 'var(--mm-primary)' }}>一枚</span>。<br />
              コンセプトカフェ・クリエイターの限定写真と動画を、
              あなただけにお届けします。
            </p>

            {/* CTA ペア */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/contents" className="mm-btn-primary" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'var(--mm-ink)', color: 'white',
                padding: '16px 32px', borderRadius: 999,
                fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
                textDecoration: 'none',
                boxShadow: '0 8px 24px -8px rgba(31,26,21,0.4)',
              }}>
                コンテンツを見る
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, lineHeight: 1 }}>→</span>
              </Link>
              <Link href="/auth/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                color: 'var(--mm-text)',
                padding: '14px 8px',
                fontWeight: 600, fontSize: 13,
                textDecoration: 'none',
                borderBottom: '1px solid var(--mm-ink)',
                letterSpacing: '0.04em',
              }}>
                無料で会員登録（30秒）
              </Link>
            </div>

            {/* メタ行: 会員数 / レーティング / コンテンツ数の実数値表示
                ※ ローンチ直後は実数が小さくサービス信用を損ねるため、当面非表示にする。
                   会員数1000人 or コンテンツ100件 突破時に DB 実数を SSR で取得して復活させる。
                   過去に存在していた "1,240+ / ★4.9 / 420+" は虚偽表示のため削除済み。 */}
          </div>

          {/* ── 右カラム: ポラロイド・スタック ───────────────────── */}
          <div className="mm-hero-polaroids">
            {/* polaroid 1: 写真コンテンツ風（後ろ） */}
            <div className="mm-polaroid mm-polaroid-1" style={{ zIndex: 1 }}>
              <div className="mm-polaroid-photo" style={{
                background: HERO_POLAROIDS[0].src ? '#f5d4be' : 'linear-gradient(135deg, #f5d4be 0%, #d36b24 60%, #b85a1c 100%)',
              }}>
                {HERO_POLAROIDS[0].src && (
                  <img src={HERO_POLAROIDS[0].src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {/* ブランドカラー オーバーレイ */}
                {HERO_POLAROIDS[0].src && (
                  <div style={{ position: 'absolute', inset: 0, background: HERO_POLAROIDS[0].tint }} />
                )}
                {!HERO_POLAROIDS[0].src && (
                  <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
                {/* EXCLUSIVE バッジ */}
                <span style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 2,
                  background: 'rgba(255,255,255,0.95)', color: 'var(--mm-primary)',
                  fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                  letterSpacing: '0.08em',
                }}>★ EXCLUSIVE</span>
              </div>
              <div className="mm-polaroid-caption">あいさんから</div>
            </div>

            {/* polaroid 2: メッセージ風（中央） */}
            <div className="mm-polaroid mm-polaroid-2" style={{ zIndex: 3 }}>
              <div className="mm-polaroid-photo" style={{
                background: 'linear-gradient(160deg, #dcedf3 0%, #258eac 70%, #1a6c85 100%)',
              }}>
                <div style={{
                  textAlign: 'center', color: 'white',
                  padding: '0 14px',
                }}>
                  <div className="font-script" style={{
                    fontSize: 28, fontWeight: 600, lineHeight: 1.2, marginBottom: 8,
                    textShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}>Dear you,</div>
                  <div className="font-script" style={{
                    fontSize: 14, lineHeight: 1.6, opacity: 0.95,
                    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  }}>いつも応援<br/>ありがとう ♡</div>
                </div>
              </div>
              <div className="mm-polaroid-caption">手書きメッセージ付き</div>
            </div>

            {/* polaroid 3: 動画コンテンツ風（前） */}
            <div className="mm-polaroid mm-polaroid-3" style={{ zIndex: 2 }}>
              <div className="mm-polaroid-photo" style={{
                background: HERO_POLAROIDS[2].src ? '#fce9d8' : 'linear-gradient(135deg, #fce9d8 0%, #f5b88a 50%, #d36b24 100%)',
              }}>
                {HERO_POLAROIDS[2].src && (
                  <img src={HERO_POLAROIDS[2].src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {HERO_POLAROIDS[2].src && (
                  <div style={{ position: 'absolute', inset: 0, background: HERO_POLAROIDS[2].tint }} />
                )}
                {/* Play button（常に表示） */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)', zIndex: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)', position: 'relative',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--mm-primary)">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <span style={{
                  position: 'absolute', bottom: 10, left: 10, zIndex: 2,
                  background: 'rgba(31,26,21,0.85)', color: 'white',
                  fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                  letterSpacing: '0.08em',
                }}>VIDEO · 02:14</span>
              </div>
              <div className="mm-polaroid-caption">特別な動画メッセージ</div>
            </div>

            {/* デコレーション: 手書き矢印 */}
            <svg
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) rotate(-8deg)',
                width: '70%', height: '70%',
                pointerEvents: 'none',
                opacity: 0.06,
              }}
              viewBox="0 0 200 200" fill="none" stroke="var(--mm-ink)" strokeWidth="1"
            >
              <circle cx="100" cy="100" r="80" strokeDasharray="3 6" />
            </svg>
          </div>
        </div>
      </section>

      {/* STATS セクションは Hero に統合済 — 削除 */}

      {/* ━━━ 特集バナー ━━━ */}
      {banners && banners.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
              FEATURED
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: banners.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {(banners as any[]).map((b: any) => {
              const href = b.link_url ?? (b.content_id ? `/contents/${b.content_id}` : b.creator?.username ? `/creator/${b.creator.username}` : '#')
              return (
                <Link key={b.id} href={href} style={{ textDecoration: 'none' }}>
                  <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #2a221b 0%, #4a3a2f 100%)', minHeight: 120, display: 'flex', alignItems: 'flex-end', padding: 20, boxShadow: '0 4px 20px rgba(31,26,21,0.18)' }}>
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

      {/* ━━━ Coming Soon （クリエイターもコンテンツもない時のフォールバック） ━━━ */}
      {(!creators || creators.length === 0) && (!contents || contents.length === 0) && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 16px 0' }}>
          <div style={{
            position: 'relative',
            background: 'white',
            border: '1px solid var(--mm-border)',
            borderRadius: 16,
            padding: 'clamp(48px, 8vw, 80px) 24px',
            textAlign: 'center',
            overflow: 'hidden',
          }}>
            {/* 装飾: コーナー枠 */}
            <span style={{ position: 'absolute', top: 16, left: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderTop: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, left: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderLeft: '1px solid var(--mm-primary)' }} />
            <span style={{ position: 'absolute', bottom: 16, right: 16, width: 24, height: 24, borderBottom: '1px solid var(--mm-primary)', borderRight: '1px solid var(--mm-primary)' }} />

            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 18 }}>
              ✦ Coming Soon
            </p>
            <h2 className="font-serif-display" style={{
              fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 500, fontStyle: 'italic',
              color: 'var(--mm-ink)', letterSpacing: '0.01em', lineHeight: 1.1, marginBottom: 18,
            }}>
              Issue 01, in the making.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.85, maxWidth: 480, margin: '0 auto 32px' }}>
              現在クリエイターの皆さんと一緒に、最初の特集を準備中です。<br />
              先行公開のお知らせはニュースレターでお届けします。
            </p>
            <Link href="/auth/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'var(--mm-ink)', color: 'white',
              padding: '14px 30px', borderRadius: 999,
              fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
              textDecoration: 'none',
            }}>
              先行公開を通知 <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, lineHeight: 1 }}>→</span>
            </Link>
          </div>
        </section>
      )}

      {/* ━━━ 人気クリエイター ━━━ */}
      {creators && creators.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 28 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
                <span className="font-serif-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-primary)' }}>01</span>
                — CREATOR
              </p>
              <h2 className="font-serif-display" style={{ fontSize: 'clamp(24px, 5vw, 30px)', fontWeight: 500, color: 'var(--mm-ink)', letterSpacing: '0.01em' }}>人気のクリエイター</h2>
            </div>
            <Link href="/creators" style={{ fontSize: 13, color: 'var(--mm-text)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid var(--mm-ink)', paddingBottom: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
              全員を見る <span style={{ color: 'var(--mm-primary)' }}>→</span>
            </Link>
          </div>
          <div className="mm-cast-grid">
            {creators.map((creator, i) => {
              const color = CREATOR_COLORS[i % CREATOR_COLORS.length]
              const count = creatorContentCounts[creator.id] ?? 0
              return (
                <Link key={creator.id} href={`/creator/${creator.username}`} className="mm-creator-card">
                  <div className="mm-creator-card-photo" style={{ background: color.bg }}>
                    {creator.avatar_url
                      ? <img src={creator.avatar_url} alt={creator.display_name} />
                      : <span className="font-serif-display" style={{ fontSize: 56, fontWeight: 500, color: color.text }}>{creator.display_name[0]}</span>}
                    {i === 0 && (
                      <span className="mm-creator-card-rank">
                        <span style={{ color: 'var(--mm-primary)' }}>★</span> No.1
                      </span>
                    )}
                  </div>
                  <div className="mm-creator-card-body">
                    <p className="mm-creator-card-name">{creator.display_name}</p>
                    <p className="mm-creator-card-handle">@{creator.username}</p>
                    <p className="mm-creator-card-count">
                      <span className="font-serif-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--mm-ink)' }}>{count}</span>
                      <span style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.18em', textTransform: 'uppercase', marginLeft: 4 }}>items</span>
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ━━━ 新着コンテンツ ━━━ */}
      {contents && contents.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 28 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
                <span className="font-serif-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-primary)' }}>02</span>
                — NEW ARRIVALS
              </p>
              <h2 className="font-serif-display" style={{ fontSize: 'clamp(24px, 5vw, 30px)', fontWeight: 500, color: 'var(--mm-ink)', letterSpacing: '0.01em' }}>新着コンテンツ</h2>
            </div>
            <Link href="/contents" style={{ fontSize: 13, color: 'var(--mm-text)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid var(--mm-ink)', paddingBottom: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
              もっと見る <span style={{ color: 'var(--mm-primary)' }}>→</span>
            </Link>
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
      <section className="mm-reveal" style={{ maxWidth: 900, margin: '88px auto 0', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
            <span className="font-serif-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-primary)' }}>03</span>
            — HOW TO
            <span style={{ width: 24, height: 1, background: 'var(--mm-primary)' }} />
          </p>
          <h2 className="font-serif-display" style={{ fontSize: 34, fontWeight: 500, color: 'var(--mm-ink)', letterSpacing: '0.06em' }}>ご利用の流れ</h2>
        </div>
        <div className="mm-howto-grid">
          {HOW_TO.map((step, i) => {
            const StepIcon = step.icon
            return (
              <div key={i} className="mm-card" style={{ padding: '32px 24px', textAlign: 'center', position: 'relative', background: 'white' }}>
                <span className="font-serif-display" style={{ fontSize: 56, fontWeight: 500, fontStyle: 'italic',
                  color: 'var(--mm-primary)', opacity: 0.18,
                  position: 'absolute', top: 8, right: 18, lineHeight: 1 }}>{step.step}</span>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <StepIcon size={26} strokeWidth={1.5} color="var(--mm-primary)" />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: 'var(--mm-ink)' }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.75 }}>{step.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ━━━ 安心ポイント ━━━ */}
      <section className="mm-reveal" style={{ maxWidth: 900, margin: '72px auto 0', padding: '0 24px' }}>
        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 16, padding: '40px 32px' }}>
          <h2 className="font-serif-display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--mm-ink)', textAlign: 'center', marginBottom: 32, letterSpacing: '0.06em' }}>安心・安全のプラットフォーム</h2>
          <div className="mm-trust-grid">
            {[
              { icon: ShieldCheck,   text: 'Stripeによる安全な決済' },
              { icon: EyeOff,        text: '閲覧履歴は完全非公開' },
              { icon: PenTool,       text: '手書きメッセージ付き納品' },
              { icon: MessageCircle, text: '通常2営業日以内の返信' },
            ].map((item, i) => {
              const TrustIcon = item.icon
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrustIcon size={18} strokeWidth={1.6} color="var(--mm-primary)" />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-text-sub)' }}>{item.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ BOTTOM CTA (ダークウォーム + オレンジ差し色) ━━━ */}
      <section className="mm-reveal" style={{ maxWidth: 1100, margin: '80px auto 0', padding: '0 16px' }}>
        <div style={{
          background: 'var(--mm-dark)',
          borderRadius: 20,
          padding: '72px 32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* multiply はダーク地で不可視のため overlay で粒子を見せる */}
          <div className="mm-grain" aria-hidden style={{ opacity: 0.25, mixBlendMode: 'overlay' }} />
          {/* 装飾: 横ライン（オレンジ） */}
          <span style={{
            display: 'inline-block', width: 56, height: 1,
            background: 'var(--mm-primary)', marginBottom: 24,
          }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 16 }}>
            <span className="font-serif-display" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em' }}>04</span> — Get Started
          </p>
          <h2 className="font-jp-serif" style={{
            fontSize: 'clamp(34px, 5vw, 52px)',
            fontWeight: 600,
            color: 'white', marginBottom: 16, letterSpacing: '0.06em', lineHeight: 1.15,
          }}>今すぐ、はじめる。</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            無料登録するだけ。30秒で完了。<br/>購入しなくてもコンテンツ一覧は自由に閲覧できます。
          </p>
          <Link href="/auth/signup" className="mm-btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--mm-primary)', color: 'white',
            padding: '18px 44px', borderRadius: 999, fontWeight: 600, fontSize: 15,
            textDecoration: 'none', letterSpacing: '0.04em',
            boxShadow: '0 12px 32px -8px rgba(211, 107, 36, 0.55)',
          }}>
            無料で会員登録
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, lineHeight: 1 }}>→</span>
          </Link>
        </div>
      </section>
      {/* セクション下マージン */}
      <div style={{ height: 80 }} />

      <Footer />
    </div>
  )
}
