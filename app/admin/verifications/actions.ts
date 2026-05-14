'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type VerificationAction = 'approve' | 'reject'

export async function reviewVerification(userId: string, action: VerificationAction, rejectionReason?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未ログインです' }

  const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (admin?.role !== 'admin') return { error: '権限がありません' }

  const patch: Record<string, unknown> = {
    identity_reviewed_at: new Date().toISOString(),
  }
  if (action === 'approve') {
    patch.identity_status = 'approved'
    patch.identity_rejection_reason = null
  } else if (action === 'reject') {
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      return { error: '却下理由を入力してください' }
    }
    patch.identity_status = 'rejected'
    patch.identity_rejection_reason = rejectionReason.trim()
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/verifications')
  return { ok: true }
}

export async function getSignedUrl(path: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未ログインです' }

  const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (admin?.role !== 'admin') return { error: '権限がありません' }

  const { data, error } = await supabase.storage.from('identity_documents').createSignedUrl(path, 300)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
