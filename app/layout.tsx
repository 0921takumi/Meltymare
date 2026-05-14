import type { Metadata } from 'next'
import './globals.css'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'My Focus | クリエイターの限定コンテンツを購入',
    template: '%s | My Focus',
  },
  description: 'コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム。メッセージ入りチェキ、パーソナルビデオなど、あなただけの特別なコンテンツをお届けします。',
  keywords: ['コンセプトカフェ', 'チェキ', 'クリエイター', '限定写真', 'パーソナルコンテンツ', '推し活'],
  // OG/Twitter 画像は /app/opengraph-image.png と /app/twitter-image.png をNext.jsが自動採用するため images 配列は省略。
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: APP_URL,
    siteName: 'My Focus',
    title: 'My Focus | クリエイターの限定コンテンツを購入',
    description: 'コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Focus | クリエイターの限定コンテンツを購入',
    description: 'コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="theme-color" content="#d36b24" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
