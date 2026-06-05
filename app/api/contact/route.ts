import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { escapeHtml, sanitizeText } from '@/lib/sanitize'

const supabase = createServiceClient(
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

export async function POST(req: NextRequest) {
  try {
    // 認証不要 API なので IP ベースで rate limit。
    // 攻撃シナリオ: 他人のメアドを email に指定して大量送信 → その人に「受付確認メール」
    // が大量に届く（spam relay）。5req/分で十分防げる。
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const rl = await rateLimit({ key: `contact:${ip}`, limit: 5, windowSec: 60 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください' }, { status: 429 })
    }

    const { name, email, category, subject, message } = await req.json()

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: '必須項目が未入力です' }, { status: 400 })
    }
    // 制御文字を除去し長さ制限する（DB汚染・改行注入対策）
    const cleanName = sanitizeText(name, { maxLength: 100, allowNewlines: false })
    const cleanSubject = sanitizeText(subject, { maxLength: 200, allowNewlines: false })
    const cleanMessage = sanitizeText(message, { maxLength: 5000, allowNewlines: true })
    if (typeof name !== 'string' || !cleanName) {
      return NextResponse.json({ error: 'お名前を正しく入力してください' }, { status: 400 })
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'メールアドレスを正しく入力してください' }, { status: 400 })
    }
    const cat = typeof category === 'string' && ALLOWED_CATEGORIES.includes(category) ? category : 'general'
    if (typeof subject !== 'string' || !cleanSubject) {
      return NextResponse.json({ error: '件名を入力してください' }, { status: 400 })
    }
    if (typeof message !== 'string' || message.length > 5000) {
      return NextResponse.json({ error: 'メッセージが長すぎます' }, { status: 400 })
    }

    // DB保存
    const { error: dbError } = await supabase.from('contact_messages').insert({
      name: cleanName, email, category: cat, subject: cleanSubject, message: cleanMessage, status: 'open',
    })
    if (dbError) {
      console.error('Contact DB error:', dbError)
      // テーブル未作成でもメールは送る
    }

    // メール通知（RESEND_API_KEYがあれば）
    const resendKey = process.env.RESEND_API_KEY
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? 'info@my-focus.jp'
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'My Focus <noreply@my-focus.jp>'

    if (resendKey) {
      // 管理者への通知
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: adminEmail,
          reply_to: email,
          subject: `【My Focus お問い合わせ】${CATEGORY_LABELS[cat]}: ${subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 24px;">
              <h2 style="color:#1a2f4a;">新しいお問い合わせが届きました</h2>
              <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold; width:120px;">カテゴリ</td><td style="padding:8px;">${escapeHtml(CATEGORY_LABELS[cat])}</td></tr>
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">お名前</td><td style="padding:8px;">${escapeHtml(cleanName)}</td></tr>
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">メール</td><td style="padding:8px;">${escapeHtml(email)}</td></tr>
                <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">件名</td><td style="padding:8px;">${escapeHtml(cleanSubject)}</td></tr>
              </table>
              <div style="padding:16px; background:#f9f9f9; border-left:3px solid #2d6a9f; white-space:pre-wrap; line-height:1.7;">${escapeHtml(cleanMessage)}</div>
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
          subject: '【My Focus】お問い合わせを受け付けました',
          html: `
            <div style="font-family: sans-serif; max-width: 560px; padding: 24px;">
              <h2 style="color:#1a2f4a;">お問い合わせありがとうございます</h2>
              <p>${escapeHtml(cleanName)} さん</p>
              <p style="line-height:1.7;">以下の内容でお問い合わせを受け付けました。<br>通常2営業日以内にご返信いたします。</p>
              <div style="padding:16px; background:#f9f9f9; border-radius:8px; margin:16px 0;">
                <p style="margin:0 0 8px;"><strong>カテゴリ:</strong> ${escapeHtml(CATEGORY_LABELS[cat])}</p>
                <p style="margin:0 0 8px;"><strong>件名:</strong> ${escapeHtml(cleanSubject)}</p>
                <div style="white-space:pre-wrap; line-height:1.7; color:#555; margin-top:12px;">${escapeHtml(cleanMessage)}</div>
              </div>
              <p style="margin-top:24px; font-size:12px; color:#888;">
                このメールは My Focus から自動送信されています。<br>
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
