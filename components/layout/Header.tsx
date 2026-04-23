'use client'
import Link from 'next/link'
import { ShoppingBag, User, LogIn, Menu, Search, X } from 'lucide-react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'

interface HeaderProps {
  user?: { display_name: string; role: string } | null
}

export default function Header({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <header style={{ background: 'white', borderBottom: '1px solid var(--mm-border)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: 'var(--mm-primary)', letterSpacing: '0.05em' }}>
            MyFocus
          </span>
        </Link>

        {/* 検索バー（デスクトップ） */}
        <form onSubmit={handleSearch} className="mm-search-desktop" style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="クリエイター・コンテンツを検索..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--mm-bg)', boxSizing: 'border-box' }}
          />
        </form>

        {/* デスクトップNav */}
        <nav className="mm-header-nav" style={{ marginLeft: 'auto' }}>
          <Link href="/contents" style={{ padding: '8px 14px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none', borderRadius: 8 }}>
            コンテンツ
          </Link>
          <Link href="/creators" style={{ padding: '8px 14px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none', borderRadius: 8 }}>
            クリエイター
          </Link>
          {user ? (
            <>
              <NotificationBell />
              <Link href="/mypage" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none' }}>
                <ShoppingBag size={16} />マイページ
              </Link>
              {user.role === 'creator' && (
                <Link href="/creator/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, background: 'var(--mm-primary)', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
                  <User size={15} />管理
                </Link>
              )}
              <form action="/api/auth/signout" method="POST">
                <button type="submit" style={{ padding: '8px 12px', fontSize: 13, color: 'var(--mm-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none' }}>
                <LogIn size={16} />ログイン
              </Link>
              <Link href="/auth/signup" style={{ padding: '8px 18px', fontSize: 14, background: 'var(--mm-primary)', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
                登録
              </Link>
            </>
          )}
        </nav>

        {/* モバイルNav */}
        <div className="mm-header-nav-mobile" style={{ marginLeft: 'auto' }}>
          <button onClick={openSearch} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Search size={20} color="var(--mm-text)" />
          </button>
          {!user && (
            <Link href="/auth/signup" style={{ padding: '7px 14px', fontSize: 13, background: 'var(--mm-primary)', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
              登録
            </Link>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Menu size={22} color="var(--mm-text)" />
          </button>
        </div>
      </div>

      {/* モバイル検索オーバーレイ */}
      {searchOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-start', paddingTop: 56 }}>
          <div style={{ width: '100%', background: 'white', padding: '16px' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="クリエイター・コンテンツを検索..."
                  style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" style={{ padding: '10px 16px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                検索
              </button>
              <button type="button" onClick={() => setSearchOpen(false)} style={{ padding: '10px', background: 'none', border: '1px solid var(--mm-border)', borderRadius: 8, cursor: 'pointer' }}>
                <X size={16} color="var(--mm-text-muted)" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* モバイルドロワーメニュー */}
      {menuOpen && (
        <div style={{ background: 'white', borderTop: '1px solid var(--mm-border)', padding: '12px 16px 20px' }}>
          <Link href="/contents" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--mm-text)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)' }}>
            コンテンツ一覧
          </Link>
          <Link href="/creators" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--mm-text)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)' }}>
            クリエイター一覧
          </Link>
          {user ? (
            <>
              <Link href="/mypage" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 15, color: 'var(--mm-text)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)' }}>
                <ShoppingBag size={17} />マイページ
              </Link>
              {user.role === 'creator' && (
                <Link href="/creator/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 15, color: 'var(--mm-primary)', fontWeight: 700, textDecoration: 'none', borderBottom: '1px solid var(--mm-border)' }}>
                  <User size={17} />クリエイター管理
                </Link>
              )}
              <form action="/api/auth/signout" method="POST" style={{ marginTop: 8 }}>
                <button type="submit" style={{ padding: '10px 0', fontSize: 14, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 15, color: 'var(--mm-text)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)' }}>
                <LogIn size={17} />ログイン
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
