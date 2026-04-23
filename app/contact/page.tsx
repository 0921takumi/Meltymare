import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import ContactForm from './ContactForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: 'MyFocusへのお問い合わせはこちらから',
}

export default async function ContactPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>お問い合わせ</h1>
        <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
          サービスに関するご質問・ご要望・不具合のご報告などはこちらからお送りください。<br />
          通常2営業日以内にご返信いたします。
        </p>

        <ContactForm
          defaultName={profile?.display_name ?? ''}
          defaultEmail={user?.email ?? ''}
        />

        <div style={{ marginTop: 32, padding: 20, background: 'var(--mm-bg)', border: '1px solid var(--mm-border)', borderRadius: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>メールでのお問い合わせ</p>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.8 }}>
            メール: info@my-focus.jp<br />
            運営: 株式会社91&amp;Co.<br />
            所在地: 東京都北区神谷2-21-7
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
