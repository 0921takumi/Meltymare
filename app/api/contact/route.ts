import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_CATEGORIES = ['general', 'bug', 'payment', 'account', 'creator', 'other']
const CATEGORY_LABELS: Record<string, string> = {
  general: 'サービスに関する質問',
  bug: '不具合・エラー',
  payment: '決済・返金について',
  account: 'アカウントについて',
  creator: 'クリエイター登録・出品について',
  other: 'その他',
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, category, subject, message } = await req.json()

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: '必須項目が未入力です' }, { status: 400 })
    }
    if (typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'お名前が不正です' }, { status: 400 })
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'メールアドレスが不正です' }, { status: 400 })
    }
    const cat = typeof category === 'string' && ALLOWED_CATEGORIES.includes(category) ? category : 'general'
    if (typeof subject !== 'string' || subject.length > 200) {
      return NextResponse.json({ error: '件名が不正です' }, { status: 400 })
    }
    if (typeof message !== 'string' || message.length > 5000) {
      return NextResponse.json({ error: 'メッセージが長すぎます' }, { status: 400 })
    }

    // DB保存
    const { error: dbError } = await supabase.from('contact_messages').insert({
      name, email, category: cat, subject, message, status: 'open',
    })
    if (dbError) {
      console.error('Contact DB error:', dbError)
      // テーブル未作成でもメールは送る
    }

    // メール通知（RESEND_API_KEYがあれば）
    const resendKey = process.env.RESEND_API_KEY
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? 'info@my-focus.jp'
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'MyFocus <noreply@my-focus.jp>'

    if (resendKey) {
      // 管理者への通知
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: adminEmail,
          reply_to: email,
          subject: `【MyFocus お問い合わせ】${CATEGORY_LABELS[cat]}: ${subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 24px;">
              <h2 style="color:#1a2f4a;">新しいお問い合わせが届きました</h2>
              <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold; width:120px;">カテゴリ</td><td style="padding:8px;">${escapeHtml(CATEGORY_LABELS[cat])}</td></tr>
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">お名前</td><td style="padding:8px;">${escapeHtml(name)}</td></tr>
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">メール</td><td style="padding:8px;">${escapeHtml(email)}</td></tr>
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">件名</td><td style="padding:8px;">${escapeHtml(subject)}</td></tr>
              </table>
              <div style="padding:16px; background:#f9f9f9; border-left:3px solid #2d6a9f; white-space:pre-wrap; line-height:1.7;">${escapeHtml(message)}</div>
              <p style="margin-top:20px; font-size:12px; color:#888;">返信する場合は Reply-To: ${escapeHtml(email)} に返信してください。</p>
            </div>
          `,
        }),
      }).catch((e) => console.error('Admin notify email error:', e))

      // ユーザーへの受付確認
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: '【MyFocus】お問い合わせを受け付けました',
          html: `
            <div style="font-family: sans-serif; max-width: 560px; padding: 24px;">
              <h2 style="color:#1a2f4a;">お問い合わせありがとうございます</h2>
              <p>${escapeHtml(name)} さん</p>
              <p style="line-height:1.7;">以下の内容でお問い合わせを受け付けました。<br>通常2営業日以内にご返信いたします。</p>
              <div style="padding:16px; background:#f9f9f9; border-radius:8px; margin:16px 0;">
                <p style="margin:0 0 8px;"><strong>カテゴリ:</strong> ${escapeHtml(CATEGORY_LABELS[cat])}</p>
                <p style="margin:0 0 8px;"><strong>件名:</strong> ${escapeHtml(subject)}</p>
                <div style="white-space:pre-wrap; line-height:1.7; color:#555; margin-top:12px;">${escapeHtml(message)}</div>
              </div>
              <p style="margin-top:24px; font-size:12px; color:#888;">
                このメールは MyFocus から自動送信されています。<br>
                運営: 株式会社91&Co. / 東京都北区神谷2-21-7
              </p>
            </div>
          `,
        }),
      }).catch((e) => console.error('User confirmation email error:', e))
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('Contact error:', e)
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }
}
