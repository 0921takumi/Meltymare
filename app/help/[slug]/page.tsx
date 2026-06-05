import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronRight, MessageCircle, ListChecks, Info,
  UserPlus, ShoppingBag, Download, Heart, Gavel, Radio,
  ShieldCheck, Camera, Wallet, Package, Ticket, Video,
  Settings, RotateCcw, Shield, HelpCircle, BarChart3,
} from 'lucide-react'
import { HELP_CATEGORIES, AUDIENCE_LABELS, getCategory } from '@/lib/help-content'

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  UserPlus, ShoppingBag, Download, Heart, Gavel, Radio,
  ShieldCheck, Camera, Wallet, Package, Ticket, Video,
  Settings, RotateCcw, Shield, BarChart3,
}

export function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategory(slug)
  if (!cat) return { title: 'ヘルプが見つかりません' }
  return {
    title: `${cat.title} | ヘルプ`,
    description: `${cat.summary} — ${AUDIENCE_LABELS[cat.audience]}のよくある質問。`,
  }
}

export default async function HelpCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cat = getCategory(slug)
  if (!cat) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username, role, avatar_url, identity_status')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const Icon = ICONS[cat.icon] ?? HelpCircle

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* パンくず */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mm-text-muted)', marginBottom: 18 }}>
          <Link href="/help" style={{ color: 'var(--mm-text-muted)', textDecoration: 'none' }}>ヘルプセンター</Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--mm-text-sub)' }}>{cat.title}</span>
        </nav>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            flexShrink: 0, width: 46, height: 46, borderRadius: 12,
            background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={22} color="var(--mm-primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 700 }}>{cat.title}</h1>
            <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>{AUDIENCE_LABELS[cat.audience]}</span>
          </div>
        </div>

        {/* 記事 */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cat.articles.map((a) => (
            <article
              key={a.id}
              id={a.id}
              style={{
                background: 'var(--mm-surface)', border: '1px solid var(--mm-border)',
                borderRadius: 14, padding: 22, scrollMarginTop: 80,
              }}
            >
              <h2 style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 12, lineHeight: 1.5 }}>
                {a.q}
              </h2>

              {a.a.map((p, i) => (
                <p key={i} style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.85, marginBottom: 8 }}>
                  {p}
                </p>
              ))}

              {a.steps && a.steps.length > 0 && (
                <div style={{ marginTop: 12, padding: 16, background: 'var(--mm-bg-soft)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--mm-text-sub)' }}>
                    <ListChecks size={15} color="var(--mm-accent)" /> 操作手順
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', counterReset: 'step' }}>
                    {a.steps.map((s, i) => (
                      <li
                        key={i}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, fontSize: 13.5, color: 'var(--mm-text-sub)', lineHeight: 1.6 }}
                      >
                        <span style={{
                          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--mm-primary)', color: 'white', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                        }}>
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {a.note && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 8,
                  background: 'var(--mm-accent-light)', display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 12.5, color: 'var(--mm-text-sub)', lineHeight: 1.6,
                }}>
                  <Info size={15} color="var(--mm-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{a.note}</span>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* お問い合わせ導線 */}
        <div style={{
          marginTop: 28, marginBottom: 24, padding: 20, borderRadius: 14,
          background: 'var(--mm-surface)', border: '1px solid var(--mm-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageCircle size={20} color="var(--mm-accent)" />
            <span style={{ fontSize: 14, color: 'var(--mm-text-sub)' }}>解決しない場合は運営へご連絡ください。</span>
          </div>
          <Link
            href="/contact"
            style={{
              background: 'var(--mm-primary)', color: 'white', padding: '10px 20px',
              borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            お問い合わせ
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
