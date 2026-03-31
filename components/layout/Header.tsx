'use client'
import Link from 'next/link'
import { ShoppingBag, User, LogIn, Menu } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  user?: { display_name: string; role: string } | null
}

export default function Header({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header style={{ background: 'white', borderBottom: '1px solid var(--mm-border)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: 'var(--mm-primary)', letterSpacing: '0.05em' }}>
            Meltymare
          </span>
        </Link>

        {/* デスクトップNav */}
        <nav className="mm-header-nav">
          <Link href="/contents" style={{ padding: '8px 14px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none', borderRadius: 8 }}>
            コンテンツ一覧
          </Link>
          {user ? (
            <>
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
        <div className="mm-header-nav-mobile">
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

      {/* モバイルドロワーメニュー */}
      {menuOpen && (
        <div style={{ background: 'white', borderTop: '1px solid var(--mm-border)', padding: '12px 16px 20px' }}>
          <Link href="/contents" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--mm-text)', textDecoration: 'none', borderBottom: '1px solid var(--mm-border)' }}>
            コンテンツ一覧
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
            <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 15, color: 'var(--mm-text)', textDecoration: 'none' }}>
              <LogIn size={17} />ログイン
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
