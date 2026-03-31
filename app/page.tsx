import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Lock, ImageIcon, VideoIcon, Star, Users, Package, TrendingUp } from 'lucide-react'

// ─── モックデータ ────────────────────────────────────────────────
const MOCK_CASTS = [
  { id: 'rina',   name: '月島 りな',   ruby: 'Rina Tsukishima', count: 23, badge: '人気No.1', color: '#e8b4c8', text: '#8b2252' },
  { id: 'aina',   name: '桜井 あいな', ruby: 'Aina Sakurai',    count: 15, badge: 'NEW',      color: '#b4d4e8', text: '#1a5276' },
  { id: 'yuka',   name: '夢野 ゆか',   ruby: 'Yuka Yumeno',    count: 31, badge: null,       color: '#c8e8b4', text: '#1e5631' },
  { id: 'miu',    name: '星河 みう',   ruby: 'Miu Hoshikawa',  count: 8,  badge: 'NEW',      color: '#e8d4b4', text: '#7d4e12' },
  { id: 'kotone', name: '七瀬 ことね', ruby: 'Kotone Nanase',  count: 19, badge: null,       color: '#d4b4e8', text: '#512e5f' },
  { id: 'rena',   name: '白石 れな',   ruby: 'Rena Shiraishi', count: 27, badge: '限定配信', color: '#e8e4b4', text: '#7d6608' },
]

const MOCK_CONTENTS = [
  { id: '1', type: 'image', title: '水着撮影会 完全版セット',        cast: '月島 りな',   price: 1500, stock: null, gradient: 'linear-gradient(135deg,#e8b4c8,#c8a0b8)', sold: 0 },
  { id: '2', type: 'video', title: '独占インタビュー動画 30min',     cast: '桜井 あいな', price: 3000, stock: 30,   gradient: 'linear-gradient(135deg,#b4cce8,#8aade0)', sold: 12 },
  { id: '3', type: 'image', title: 'プライベート浴衣フォト 20枚',    cast: '夢野 ゆか',   price: 800,  stock: null, gradient: 'linear-gradient(135deg,#c8e8b4,#a0c890)', sold: 0 },
  { id: '4', type: 'video', title: '密着1日ショートムービー',        cast: '星河 みう',   price: 2000, stock: 20,   gradient: 'linear-gradient(135deg,#e8d4b4,#d4b880)', sold: 5 },
  { id: '5', type: 'image', title: 'ランジェリー写真集 15枚',        cast: '七瀬 ことね', price: 1200, stock: null, gradient: 'linear-gradient(135deg,#d4b4e8,#b890d4)', sold: 0 },
  { id: '6', type: 'video', title: 'お部屋配信アーカイブ',           cast: '白石 れな',   price: 500,  stock: 50,   gradient: 'linear-gradient(135deg,#e8e4b4,#d4c870)', sold: 31 },
  { id: '7', type: 'image', title: 'オフショット写真100枚まとめ',    cast: '月島 りな',   price: 2500, stock: 10,   gradient: 'linear-gradient(135deg,#f4c6d8,#e8a0bc)', sold: 7 },
  { id: '8', type: 'video', title: '誕生日特別動画メッセージ',       cast: '桜井 あいな', price: 1800, stock: null, gradient: 'linear-gradient(135deg,#c0d8f4,#90b8e8)', sold: 0 },
]

const STATS = [
  { icon: Users,      value: '1,240+', label: '会員数' },
  { icon: Star,       value: '18',     label: '在籍クリエイター' },
  { icon: Package,    value: '420+',   label: 'コンテンツ数' },
  { icon: TrendingUp, value: '4.9',    label: '平均満足度' },
]

const HOW_TO = [
  { step: '01', icon: '📝', title: '無料で会員登録',       desc: 'メールアドレスだけで30秒登録。クレカ登録は購入時のみでOK。' },
  { step: '02', icon: '🔍', title: '好きなクリエイターを探す', desc: 'クリエイター一覧やコンテンツ一覧から気になる子をチェック。' },
  { step: '03', icon: '💳', title: 'カードで安全に購入',   desc: 'Stripe決済で安心。購入後はマイページからいつでも閲覧可能。' },
]
// ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={null} />

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
            color: 'white', letterSpacing: '0.1em', marginBottom: 16, lineHeight: 1.1, padding: 0 }}>Meltymare</h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.88)', marginBottom: 8, lineHeight: 1.8, fontWeight: 500 }}>
            クリエイターの限定写真・動画を購入できるプラットフォーム
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 44, letterSpacing: '0.03em' }}>
            SNSには絶対に載せない — あなただけへの特別なコンテンツ
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

      {/* ━━━ 人気キャスト ━━━ */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em', marginBottom: 6 }}>CREATOR</p>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>人気のクリエイター</h2>
          </div>
          <Link href="/contents" style={{ fontSize: 13, color: 'var(--mm-primary)', textDecoration: 'none', fontWeight: 600 }}>全員を見る →</Link>
        </div>
        <div className="mm-cast-grid">
          {MOCK_CASTS.map(cast => (
            <Link key={cast.id} href="/contents" style={{ textDecoration: 'none' }}>
              <div className="mm-card" style={{ padding: '20px 16px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: cast.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, color: cast.text, margin: '0 auto',
                    border: '3px solid white', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                    {cast.name[0]}
                  </div>
                  {cast.badge && (
                    <span style={{ position: 'absolute', top: -4, right: -8, color: 'white', fontSize: 9, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 10, whiteSpace: 'nowrap',
                      background: cast.badge === 'NEW' ? '#ef4444' : cast.badge === '人気No.1' ? '#f59e0b' : 'var(--mm-primary)',
                    }}>{cast.badge}</span>
                  )}
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text)', marginBottom: 2 }}>{cast.name}</p>
                <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 8 }}>{cast.ruby}</p>
                <p style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 600 }}>📦 {cast.count}件</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ━━━ 新着コンテンツ ━━━ */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.12em', marginBottom: 6 }}>CONTENTS</p>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>新着コンテンツ</h2>
          </div>
          <Link href="/contents" style={{ fontSize: 13, color: 'var(--mm-primary)', textDecoration: 'none', fontWeight: 600 }}>もっと見る →</Link>
        </div>
        <div className="mm-content-grid">
          {MOCK_CONTENTS.map(item => {
            const remain = item.stock ? item.stock - item.sold : null
            const soldOut = remain !== null && remain <= 0
            return (
              <Link key={item.id} href="/auth/signup" style={{ textDecoration: 'none', display: 'block' }}>
                <div className="mm-card" style={{ cursor: 'pointer' }}>
                  <div style={{ position: 'relative', aspectRatio: '4/3', background: item.gradient,
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ opacity: 0.25, transform: 'scale(2.5)' }}>
                      {item.type === 'video' ? <VideoIcon size={32} color="white" /> : <ImageIcon size={32} color="white" />}
                    </div>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 36, height: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={16} color="white" />
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
                      <span style={{ background: item.type === 'video' ? '#7c3aed' : 'var(--mm-primary)',
                        color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                        {item.type === 'video' ? '動画' : '画像'}
                      </span>
                      {soldOut && <span style={{ background: '#6b7280', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>SOLD OUT</span>}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>{item.cast}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--mm-text)', marginBottom: 8,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mm-primary)' }}>¥{item.price.toLocaleString()}</span>
                      {item.stock && !soldOut && (
                        <span style={{ fontSize: 11, color: remain! <= 5 ? '#dc2626' : 'var(--mm-text-muted)' }}>残り {remain} 枚</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

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
              { icon: '📲', text: '購入後は永久保存' },
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

      {/* フッター */}
      <footer style={{ borderTop: '1px solid var(--mm-border)', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>
          © 2025 Meltymare · <Link href="/contact" style={{ color: 'var(--mm-text-muted)' }}>お問い合わせ</Link>
        </p>
      </footer>
    </div>
  )
}
