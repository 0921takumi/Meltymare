'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED_STATUS = ['open', 'in_progress', 'resolved']

// 監査で発覚: 従来はブラウザから直接 supabase.from('contact_messages').update(...) を
// 呼んでおり、RLSは admin 限定(contact_update_admin)で安全だが、他の管理操作
// （contents承認/払戻/ユーザー凍結等）と違い admin_actions への記録が一切無かった。
// server action 化し、他の管理操作と同じ監査ログ粒度に揃える。
export async function updateInquiryStatus(id: string, newStatus: string, adminNote: string) {
  if (!ALLOWED_STATUS.includes(newStatus)) return { error: '無効なステータスです' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未ログインです' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: '権限がありません' }

  const { data: updated, error } = await supabase
    .from('contact_messages')
    .update({ status: newStatus, admin_note: adminNote })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!updated) return { error: '更新対象が見つかりません' }

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'inquiry_status_change',
    target_type: 'contact_message',
    target_id: id,
    detail: { status: newStatus },
  })

  revalidatePath('/admin/inquiries')
  return { ok: true }
}
