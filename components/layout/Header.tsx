'use client'
import Link from 'next/link'
import { ShoppingBag, User, LogIn } from 'lucide-react'

interface HeaderProps {
  user?: { display_name: string; role: string } | null
}

export default function Header({ user }: HeaderProps) {
  return (
    <header style={{ background: 'white', borderBottom: '1px solid var(--mm-border)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 600, color: 'var(--mm-primary)', letterSpacing: '0.05em' }}>
            Meltymare
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/contents" style={{ padding: '8px 16px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none', borderRadius: 8 }}>
            コンテンツ一覧
          </Link>

          {user ? (
            <>
              <Link href="/mypage" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none' }}>
                <ShoppingBag size={16} />
                マイページ
              </Link>
              {user.role === 'creator' && (
                <Link href="/creator/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, background: 'var(--mm-primary)', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
                  <User size={15} />
                  管理
                </Link>
              )}
              <form action="/api/auth/signout" method="POST">
                <button type="submit" style={{ padding: '8px 14px', fontSize: 13, color: 'var(--mm-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 14, color: 'var(--mm-text-sub)', textDecoration: 'none' }}>
                <LogIn size={16} />
                ログイン
              </Link>
              <Link href="/auth/signup" style={{ padding: '8px 18px', fontSize: 14, background: 'var(--mm-primary)', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
                登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
