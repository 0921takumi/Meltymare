'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sanitizeText } from '@/lib/sanitize'

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
    // 実運用で発覚: 本人確認の承認は「role='user'をcreatorに昇格させる」処理を一切
    // 伴っておらず、/admin/users の別ボタン(クリエイターに昇格)を admin が別途
    // 手動で押さない限り、承認済みなのに商品登録・販売管理ページに一生アクセスできない
    // 状態になっていた（実際にこれで詰まったクリエイターが出た）。
    // 本人確認の承認＝クリエイターとして活動開始、という利用者側の期待に合わせ、
    // role='user'のときだけ自動でcreatorに昇格させる（既にadminの場合は変更しない）。
    const { data: target } = await supabase.from('profiles').select('role').eq('id', userId).single()
    if (target?.role === 'user') patch.role = 'creator'
  } else if (action === 'reject') {
    // 他のadmin自由入力欄(suspended_reason/banner文言/invite note等)と同じくsanitizeText経由に統一
    // （監査で発覚: ここだけ制御文字除去・文字数上限が無く、クリエイターへ通知される文面のため）
    const reason = sanitizeText(rejectionReason, { maxLength: 500, allowNewlines: true })
    if (reason.length < 3) {
      return { error: '却下理由を入力してください' }
    }
    patch.identity_status = 'rejected'
    patch.identity_rejection_reason = reason
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
