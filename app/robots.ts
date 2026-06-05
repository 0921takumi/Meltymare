import type { MetadataRoute } from 'next'

// 環境変数に末尾改行/空白が混入していてもURLを破壊しないよう trim する
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp').trim()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/mypage',
          '/creator/dashboard',
          '/creator/orders',
          '/creator/upload',
          '/creator/coupons',
          '/creator/requests',
          '/purchase/',
          '/auth/reset-password',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
