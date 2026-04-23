import type { MetadataRoute } from 'next'
import { createClient as createServerClient } from '@supabase/supabase-js'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-focus.jp'

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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: contents } = await supabase
      .from('contents')
      .select('id, updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(1000)

    const { data: creators } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .eq('role', 'creator')
      .not('username', 'is', null)
      .limit(1000)

    const contentPaths: MetadataRoute.Sitemap = (contents ?? []).map((c: any) => ({
      url: `${BASE_URL}/contents/${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const creatorPaths: MetadataRoute.Sitemap = (creators ?? [])
      .filter((c: any) => c.username)
      .map((c: any) => ({
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
