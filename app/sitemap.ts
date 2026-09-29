import type { MetadataRoute } from 'next'
import { createClient as createServerClient } from '@supabase/supabase-js'

// 環境変数に末尾改行/空白が混入していてもURLを破壊しないよう trim する
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp').trim()
type ContentSitemapRow = { id: string; updated_at: string | null; sale_starts_at: string }
type CreatorSitemapRow = { username: string | null; updated_at: string | null }

// 予約商品の解禁後、再デプロイなしで次回クロールから掲載する。
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/contents`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/creators`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/search`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/auth/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/auth/signup`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/tokushoho`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  try {
    const saleNowIso = new Date().toISOString()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: contents } = await supabase
      .from('contents')
      .select('id, updated_at, sale_starts_at')
      .eq('is_published', true)
      .neq('review_status', 'rejected')
      .eq('hard_takedown', false)
      .lte('sale_starts_at', saleNowIso)
      // 解禁直後の予約商品を1000件上限の外へ押し出さないよう、販売開始順で取得する。
      .order('sale_starts_at', { ascending: false })
      .limit(1000)

    const { data: creators } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .eq('role', 'creator')
      .not('username', 'is', null)
      .limit(1000)

    const contentRows = (contents ?? []) as ContentSitemapRow[]
    const creatorRows = (creators ?? []) as CreatorSitemapRow[]

    const contentPaths: MetadataRoute.Sitemap = contentRows.map(c => ({
      url: `${BASE_URL}/contents/${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const creatorPaths: MetadataRoute.Sitemap = creatorRows
      .filter((c): c is CreatorSitemapRow & { username: string } => !!c.username)
      .map(c => ({
        url: `${BASE_URL}/creator/${c.username}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))

    return [...staticPaths, ...contentPaths, ...creatorPaths]
  } catch (e) {
    console.error('Sitemap generation error:', e)
    return staticPaths
  }
}
