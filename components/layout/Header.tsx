'use client'
import Link from 'next/link'
import Image from 'next/image'
import {
  User, LogIn, Menu, Search, X, ShoppingBag, Heart, Home,
  Compass, Sparkles, Camera, Video, Cake, MessageCircle, Shirt,
  Trophy, Crown, Settings, LogOut, BookOpenCheck, ShieldCheck, PlusSquare,
  Radio, BarChart3, Gem, Ban,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'
import { FEATURES } from '@/lib/config'

// 機能フラグで無効化されたカテゴリを除外
const isCategoryEnabled = (key: string) =>
  (key !== 'stories' || FEATURES.stories) && (key !== 'live' || FEATURES.live)

interface HeaderProps {
  user?: { display_name?: string; username?: string; role?: string; avatar_url?: string | null; identity_status?: string } | null
}

const CATEGORIES: { key: string; label: string; icon: React.ComponentType<{ size?: number }>; href: string; tint?: string }[] = [
  { key: 'home',      label: 'ホーム',    icon: Home,          href: '/' },
  { key: 'discover',  label: '探す',      icon: Compass,       href: '/contents' },
  { key: 'stories',   label: 'ストーリー', icon: Sparkles,      href: '/stories',              tint: '#a855f7' },
  { key: 'live',      label: 'ライブ',    icon: Radio,         href: '/live',                 tint: '#dc2626' },
  { key: 'polls',     label: 'アンケート', icon: BarChart3,     href: '/polls',                tint: '#7c3aed' },
  { key: 'birthday',  label: 'バースデー', icon: Cake,          href: '/birthdays',            tint: '#db2777' },
  { key: 'ranking',   label: 'ランキング', icon: Trophy,        href: '/rankings',             tint: '#d97706' },
  { key: 'cheki',     label: 'チェキ',    icon: Camera,        href: '/contents?tag=チェキ' },
  { key: 'video',     label: '動画',      icon: Video,         href: '/contents?tag=動画' },
  { key: 'diagnosis', label: '推し診断',  icon: Heart,         href: '/diagnosis',            tint: '#db2777' },
]

export default function Header({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Escape で検索オーバーレイ／ドロップダウンを閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setAvatarMenuOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery('')
    }
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const initial = (user?.display_name ?? user?.username ?? '?').charAt(0).toUpperCase()
  const isAdminArea = pathname?.startsWith('/admin')

  // 管理画面内ではシンプルヘッダー
  if (isAdminArea) return null

  return (
    <>
      <header style={{ background: 'white', borderBottom: '1px solid var(--mm-border)', position: 'sticky', top: 0, zIndex: 50 }}>
        {/* 1段目: ロゴ・検索・ベル・アバター */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }} aria-label="My Focus トップへ">
            {/* ロゴ: 高さ 44px・SVGのviewBoxはロゴ実寸でクロップ済（298x277）
                Next.js Imageでwidth/heightは intrinsic ratio 用、実描画はstyleで指定 */}
            <Image
              src="/logo.svg"
              alt="My Focus"
              width={48}
              height={44}
              priority
              unoptimized
              style={{ height: 44, width: 'auto' }}
            />
          </Link>

          {/* 検索バー（デスクトップ） */}
          <form onSubmit={handleSearch} className="mm-search-desktop" style={{ flex: 1, maxWidth: 520, position: 'relative', marginLeft: 12 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="クリエイター・タグ・コンテンツを検索"
              className="mm-search-input"
              style={{ width: '100%', padding: '9px 12px 9px 38px', border: '1px solid var(--mm-border)', borderRadius: 999, fontSize: 13, outline: 'none', background: 'var(--mm-bg)', boxSizing: 'border-box' }}
            />
          </form>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* モバイル検索アイコン */}
            <button className="mm-header-nav-mobile" onClick={openSearch} aria-label="検索" style={{ padding: 12, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <Search size={20} color="var(--mm-text)" />
            </button>

            {user ? (
              <>
                {/* 通知ベル */}
                <NotificationBell />

                {/* アバター + ドロップダウン */}
                <div ref={avatarRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setAvatarMenuOpen(v => !v)}
                    aria-label="メニューを開く"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', color: 'var(--mm-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                      {user.avatar_url
                        ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initial}
                    </div>
                  </button>

                  {avatarMenuOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 260,
                      background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 60,
                    }}>
                      {/* ユーザーヘッダー */}
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--mm-border)', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text)' }}>{user.display_name ?? user.username}</p>
                        <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                          @{user.username}
                          {user.role === 'creator' && <span style={{ marginLeft: 6, background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 700 }}>CREATOR</span>}
                          {user.role === 'admin'   && <span style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 700 }}>ADMIN</span>}
                        </p>
                      </div>
                      <DropdownItem href="/mypage" icon={ShoppingBag} label="マイページ" onClick={() => setAvatarMenuOpen(false)} />
                      <DropdownItem href="/mypage/collection" icon={BookOpenCheck} label="コレクション" sub="購入した推しの記録" onClick={() => setAvatarMenuOpen(false)} />
                      <DropdownItem href="/mypage/follows" icon={Heart} label="フォロー中" onClick={() => setAvatarMenuOpen(false)} />
                      <DropdownItem href="/mypage/oshikatsu" icon={Sparkles} label="推し活記録" sub="支出・推し期間" onClick={() => setAvatarMenuOpen(false)} />
                      {FEATURES.subscriptions && <DropdownItem href="/mypage/subscriptions" icon={Gem} label="サブスク" sub="加入中プラン" onClick={() => setAvatarMenuOpen(false)} />}
                      <DropdownItem href="/mypage/profile" icon={Settings} label="プロフィール設定" onClick={() => setAvatarMenuOpen(false)} />
                      {user.role === 'creator' && (
                        <>
                          <div style={{ borderTop: '1px solid var(--mm-border)' }} />
                          <DropdownItem href="/creator/dashboard" icon={User} label="クリエイター管理" highlight onClick={() => setAvatarMenuOpen(false)} />
                          <DropdownItem href="/creator/upload" icon={PlusSquare} label="コンテンツを追加" onClick={() => setAvatarMenuOpen(false)} />
                          {FEATURES.stories && <DropdownItem href="/creator/stories" icon={Sparkles} label="ストーリー" sub="24h投稿" onClick={() => setAvatarMenuOpen(false)} />}
                          {FEATURES.live && <DropdownItem href="/creator/live" icon={Radio} label="ライブ配信" sub="配信予約・管理" onClick={() => setAvatarMenuOpen(false)} />}
                          {FEATURES.subscriptions && <DropdownItem href="/creator/plans" icon={Gem} label="サブスクプラン" sub="月額メンバーシップ" onClick={() => setAvatarMenuOpen(false)} />}
                          <DropdownItem href="/creator/polls" icon={BarChart3} label="アンケート" sub="ファンに質問して投票" onClick={() => setAvatarMenuOpen(false)} />
                          <DropdownItem href="/creator/blocks" icon={Ban} label="ブロック管理" sub="購入者をブロック" onClick={() => setAvatarMenuOpen(false)} />
                          {user.identity_status !== 'approved' && (
                            <DropdownItem href="/creator/verification" icon={ShieldCheck} label="本人確認" warn onClick={() => setAvatarMenuOpen(false)} />
                          )}
                        </>
                      )}
                      {user.role === 'admin' && (
                        <>
                          <div style={{ borderTop: '1px solid var(--mm-border)' }} />
                          <DropdownItem href="/admin" icon={Crown} label="管理コンソール" highlight onClick={() => setAvatarMenuOpen(false)} />
                        </>
                      )}
                      <div style={{ borderTop: '1px solid var(--mm-border)' }} />
                      <form action="/api/auth/signout" method="POST">
                        <button type="submit" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left' }}>
                          <LogOut size={15} /> ログアウト
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="mm-header-nav" style={{ alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13, color: 'var(--mm-text-sub)', textDecoration: 'none' }}>
                  <LogIn size={15} />ログイン
                </Link>
                <Link href="/auth/signup" className="mm-btn-primary" style={{ padding: '11px 18px', fontSize: 13, background: 'var(--mm-primary)', color: 'white', textDecoration: 'none', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  はじめる
                </Link>
              </>
            )}

            {/* モバイルハンバーガー */}
            <button className="mm-header-nav-mobile" onClick={() => setMenuOpen(v => !v)} aria-label="メニュー" style={{ padding: 12, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              {menuOpen ? <X size={22} color="var(--mm-text)" /> : <Menu size={22} color="var(--mm-text)" />}
            </button>
          </div>
        </div>

        {/* 2段目: カテゴリピル（横スクロール可・右端フェードで「続き」を示唆） */}
        <div style={{ borderTop: '1px solid var(--mm-border)', background: 'white' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
            <div className="mm-category-pills" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 16px', margin: '0 -16px', scrollbarWidth: 'none' }}>
              {CATEGORIES.filter(c => isCategoryEnabled(c.key)).map(c => {
                const Icon = c.icon
                return (
                  <Link key={c.key} href={c.href} className="mm-category-pill" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 999,
                    background: 'var(--mm-bg)', color: 'var(--mm-text-sub)',
                    fontSize: 12, fontWeight: 600, textDecoration: 'none',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    border: '1px solid transparent',
                  }}>
                    <Icon size={13} />{c.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* モバイル検索オーバーレイ */}
        {searchOpen && (
          <div onClick={() => setSearchOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-start', paddingTop: 56 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', background: 'white', padding: '16px', borderRadius: '0 0 16px 16px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
                  <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="クリエイター・タグ・コンテンツを検索" style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" style={{ padding: '10px 16px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>検索</button>
                <button type="button" onClick={() => setSearchOpen(false)} style={{ padding: '10px', background: 'none', border: '1px solid var(--mm-border)', borderRadius: 8, cursor: 'pointer' }}>
                  <X size={16} color="var(--mm-text-muted)" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* モバイルドロワー（アクセス補助） */}
        {menuOpen && (
          <div style={{ background: 'white', borderTop: '1px solid var(--mm-border)', padding: '8px 16px 16px' }}>
            {user ? (
              <>
                <MobileItem href="/mypage" label="マイページ" icon={ShoppingBag} onClick={() => setMenuOpen(false)} />
                <MobileItem href="/mypage/collection" label="コレクション" icon={BookOpenCheck} onClick={() => setMenuOpen(false)} />
                <MobileItem href="/mypage/follows" label="フォロー中" icon={Heart} onClick={() => setMenuOpen(false)} />
                <MobileItem href="/mypage/oshikatsu" label="推し活記録" icon={Sparkles} onClick={() => setMenuOpen(false)} />
                <MobileItem href="/mypage/profile" label="設定" icon={Settings} onClick={() => setMenuOpen(false)} />
                {user.role === 'creator' && <MobileItem href="/creator/dashboard" label="クリエイター管理" icon={User} highlight onClick={() => setMenuOpen(false)} />}
                {user.role === 'admin'   && <MobileItem href="/admin"             label="管理コンソール"     icon={Crown} highlight onClick={() => setMenuOpen(false)} />}
                <form action="/api/auth/signout" method="POST" style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--mm-border)' }}>
                  <button type="submit" style={{ padding: '10px 0', fontSize: 14, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <LogOut size={16} /> ログアウト
                  </button>
                </form>
              </>
            ) : (
              <>
                <MobileItem href="/auth/login" label="ログイン" icon={LogIn} onClick={() => setMenuOpen(false)} />
                <MobileItem href="/auth/signup" label="はじめる" icon={PlusSquare} highlight onClick={() => setMenuOpen(false)} />
              </>
            )}
          </div>
        )}
      </header>

      {/* モバイル下部固定ナビ */}
      <MobileBottomNav user={user} pathname={pathname} />
    </>
  )
}

function DropdownItem({ href, icon: Icon, label, sub, highlight, warn, onClick }: { href: string; icon: React.ComponentType<{ size?: number }>; label: string; sub?: string; highlight?: boolean; warn?: boolean; onClick?: () => void }) {
  const color = warn ? '#dc2626' : highlight ? 'var(--mm-primary)' : 'var(--mm-text)'
  return (
    <Link href={href} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', textDecoration: 'none', color }}>
      <Icon size={15} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: highlight ? 700 : 500 }}>{label}</span>
        {sub && <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 1 }}>{sub}</p>}
      </div>
      {warn && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>要対応</span>}
    </Link>
  )
}

function MobileItem({ href, label, icon: Icon, highlight, onClick }: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; highlight?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', fontSize: 14, color: highlight ? 'var(--mm-primary)' : 'var(--mm-text)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)', fontWeight: highlight ? 700 : 500 }}>
      <Icon size={16} />{label}
    </Link>
  )
}

function MobileBottomNav({ user, pathname }: { user: HeaderProps['user']; pathname: string | null }) {
  const items = [
    { href: '/',                 label: 'ホーム',   icon: Home },
    { href: '/contents',         label: '探す',     icon: Compass },
    { href: '/diagnosis',        label: '推し診断', icon: Heart },
    { href: user ? '/mypage/collection' : '/auth/login', label: 'コレクション', icon: BookOpenCheck },
    { href: user ? '/mypage'     : '/auth/login', label: 'マイ',     icon: User },
  ]
  return (
    <nav className="mm-bottom-nav" aria-label="モバイルナビゲーション">
      {items.map(it => {
        const Icon = it.icon
        const active = pathname === it.href || (it.href !== '/' && pathname?.startsWith(it.href))
        return (
          <Link key={it.href + it.label} href={it.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, padding: '7px 4px', textDecoration: 'none',
            color: active ? 'var(--mm-primary)' : 'var(--mm-text-muted)',
            fontSize: 10, fontWeight: active ? 700 : 500,
            boxShadow: active ? 'inset 0 2px 0 var(--mm-primary)' : 'none',
            transition: 'color 0.2s',
          }}>
            <Icon size={18} />{it.label}
          </Link>
        )
      })}
    </nav>
  )
}
