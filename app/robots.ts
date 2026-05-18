import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

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
