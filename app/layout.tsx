import type { Metadata } from 'next'
import './globals.css'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'MyFocus | クリエイターの限定コンテンツを購入',
    template: '%s | MyFocus',
  },
  description: 'コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム。メッセージ入りチェキ、パーソナルビデオなど、あなただけの特別なコンテンツをお届けします。',
  keywords: ['コンセプトカフェ', 'チェキ', 'クリエイター', '限定写真', 'パーソナルコンテンツ', '推し活'],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: APP_URL,
    siteName: 'MyFocus',
    title: 'MyFocus | クリエイターの限定コンテンツを購入',
    description: 'コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'MyFocus' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyFocus | クリエイターの限定コンテンツを購入',
    description: 'コンセプトカフェ・クリエイターの限定写真・動画を直接購入できるプラットフォーム',
    images: ['/og-default.png'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="theme-color" content="#2d6a9f" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
