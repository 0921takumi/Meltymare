import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import {
  LifeBuoy, ChevronRight, MessageCircle,
  UserPlus, ShoppingBag, Download, Heart, Gavel, Radio,
  ShieldCheck, Camera, Wallet, Package, Ticket, Video,
  Settings, RotateCcw, Shield, HelpCircle, BarChart3,
} from 'lucide-react'
import { HELP_CATEGORIES, AUDIENCE_LABELS, flattenArticles, type HelpAudience } from '@/lib/help-content'
import HelpSearch from './HelpSearch'

export const metadata: Metadata = {
  title: 'ヘルプセンター',
  description: 'My Focus の使い方・購入・出品・本人確認・出金・返金などのよくある質問と使い方ガイド。',
}

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  UserPlus, ShoppingBag, Download, Heart, Gavel, Radio,
  ShieldCheck, Camera, Wallet, Package, Ticket, Video,
  Settings, RotateCcw, Shield, BarChart3,
}

const AUDIENCE_ORDER: HelpAudience[] = ['fan', 'creator', 'all']

export default async function HelpHomePage() {
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

  const articles = flattenArticles()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      {/* ヒーロー */}
      <div style={{ background: 'var(--mm-dark)', color: 'white', padding: '48px 24px 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <LifeBuoy size={26} color="var(--mm-primary)" />
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>ヘルプセンター</h1>
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 22 }}>
            使い方・購入・出品・本人確認・出金・返金など、よくある質問をまとめています。
          </p>
          <HelpSearch articles={articles} />
        </div>
      </div>

      {/* カテゴリ */}
      <div className="mm-page-pad" style={{ maxWidth: 980, margin: '0 auto' }}>
        {AUDIENCE_ORDER.map((aud) => {
          const cats = HELP_CATEGORIES.filter((c) => c.audience === aud)
          if (cats.length === 0) return null
          return (
            <section key={aud} style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.04em', marginBottom: 14 }}>
                {AUDIENCE_LABELS[aud]}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {cats.map((c) => {
                  const Icon = ICONS[c.icon] ?? HelpCircle
                  return (
                    <Link
                      key={c.slug}
                      href={`/help/${c.slug}`}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: 18, borderRadius: 14,
                        background: 'var(--mm-surface)', border: '1px solid var(--mm-border)',
                        textDecoration: 'none', color: 'var(--mm-text)',
                      }}
                    >
                      <div style={{
                        flexShrink: 0, width: 42, height: 42, borderRadius: 10,
                        background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={20} color="var(--mm-primary)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</span>
                          <ChevronRight size={16} color="var(--mm-text-muted)" />
                        </div>
                        <p style={{ fontSize: 12.5, color: 'var(--mm-text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                          {c.summary}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* お問い合わせ導線 */}
        <div style={{
          marginTop: 8, marginBottom: 24, padding: 24, borderRadius: 16,
          background: 'var(--mm-accent-light)', border: '1px solid var(--mm-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MessageCircle size={24} color="var(--mm-accent)" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700 }}>解決しませんでしたか？</p>
              <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', marginTop: 2 }}>
                運営チームが個別にお答えします（通常2営業日以内）。
              </p>
            </div>
          </div>
          <Link
            href="/contact"
            style={{
              background: 'var(--mm-primary)', color: 'white', padding: '12px 22px',
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
