import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meltymare',
  description: 'キャストの写真・動画を購入できるプラットフォーム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
