'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ModerationAction = 'approve' | 'reject' | 'unpublish'

export async function moderateContent(contentId: string, action: ModerationAction) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未ログインです' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: '権限がありません' }

  const patch: Record<string, unknown> = {}
  if (action === 'approve') {
    patch.review_status = 'approved'
    patch.is_published = true
  } else if (action === 'reject') {
    patch.review_status = 'rejected'
    patch.is_published = false
  } else if (action === 'unpublish') {
    patch.is_published = false
  }

  const { error } = await supabase.from('contents').update(patch).eq('id', contentId)
  if (error) return { error: error.message }

  revalidatePath('/admin/contents')
  revalidatePath('/contents')
  return { ok: true }
}
