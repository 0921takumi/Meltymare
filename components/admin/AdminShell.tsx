'use client'

/**
 * 管理画面シェル — サイドバー / モバイルドロワー / トップバーを束ねる。
 *
 * 設計原則（Baigie 管理画面UI記事準拠）:
 *   - リキッドレイアウト：横幅に応じて表示を変える
 *   - グローバルナビは左部（複雑な構造のため）
 *   - メニューは8セクション程度にグルーピング、現在地を明示
 *   - 固定表示エリア最小化：モバイルではドロワー方式
 *   - 色は3色基本：ダーク背景 + 白テキスト + オレンジアクセント
 *   - クリック数より誤操作防止を優先
 */

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, ChevronRight } from 'lucide-react'

export interface NavItem { href: string; icon: React.ComponentType<{ size?: number }>; label: string; badge?: number }
export interface NavSection { title: string; items: NavItem[] }

interface AdminShellProps {
  sections: NavSection[]
  profile: { display_name?: string | null; avatar_url?: string | null } | null
  children: React.ReactNode
}

export default function AdminShell({ sections, profile, children }: AdminShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // ルート遷移時にドロワーを閉じる
  useEffect(() => { setOpen(false) }, [pathname])

  // ドロワー開いてる間はbodyスクロールロック
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--mm-bg)' }}>
      {/* ─── モバイル トップバー ─── */}
      <header className="admin-topbar">
        <button
          onClick={() => setOpen(true)}
          aria-label="メニューを開く"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 8, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
          }}>
          <Menu size={22} />
        </button>
        <Link href="/admin" style={{
          fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600,
          color: 'white', letterSpacing: '0.04em', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          My Focus
          <span style={{ fontSize: 9, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, padding: '2px 7px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 4 }}>
            STAFF
          </span>
        </Link>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          {profile?.avatar_url && <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
      </header>

      {/* ─── モバイル ドロワー背景 ─── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="admin-drawer-backdrop"
          aria-hidden
        />
      )}

      {/* ─── サイドバー（デスクトップ）/ ドロワー（モバイル） ─── */}
      <aside
        className={`admin-sidebar ${open ? 'is-open' : ''}`}
        aria-label="管理メニュー"
      >
        {/* ヘッダー */}
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 500, fontStyle: 'italic', color: 'white', letterSpacing: '0.01em', lineHeight: 1 }}>
              My Focus
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
              <span style={{ display: 'inline-block', width: 14, height: 1, background: 'var(--mm-primary)', verticalAlign: 'middle', marginRight: 6 }} />
              Staff Console
            </span>
          </Link>
          {/* モバイルだけ閉じるボタン */}
          <button
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
            className="admin-drawer-close"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 6, color: 'rgba(255,255,255,0.7)',
            }}>
            <X size={18} />
          </button>
        </div>

        {/* ナビ本体 */}
        <nav style={{ padding: '12px 0', flex: 1, overflowY: 'auto' }}>
          {sections.map(section => (
            <div key={section.title} style={{ marginBottom: 6 }}>
              <p style={{
                padding: '12px 22px 6px',
                fontSize: 9, color: 'rgba(255,255,255,0.32)',
                fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
              }}>{section.title}</p>
              {section.items.map(({ href, icon: Icon, label, badge }) => {
                const active = pathname === href || (href !== '/admin' && pathname?.startsWith(href + '/'))
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 22px',
                      fontSize: 13,
                      color: active ? 'white' : 'rgba(255,255,255,0.72)',
                      textDecoration: 'none',
                      borderLeft: `2px solid ${active ? 'var(--mm-primary)' : 'transparent'}`,
                      background: active ? 'rgba(211, 107, 36, 0.12)' : 'transparent',
                      fontWeight: active ? 600 : 500,
                      transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                    }}>
                    <Icon size={15} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: 'var(--mm-primary)', color: 'white',
                        padding: '1px 7px', borderRadius: 999,
                        minWidth: 18, textAlign: 'center',
                      }}>{badge}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* ユーザーフッタ */}
        <Link href="/" style={{
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
          textDecoration: 'none', color: 'inherit',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
          }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (profile?.display_name?.[0] ?? 'A')}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: 12, color: 'white', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{profile?.display_name ?? 'Admin'}</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              Staff · View site
            </p>
          </div>
          <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
        </Link>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  )
}
