'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeText } from '@/lib/sanitize'

// v57: takedown は「法令違反による配信停止」。通常の却下と違い、購入済みの人の
// ダウンロードも止める（返金対応が前提の重い操作）。
export type ModerationAction = 'approve' | 'reject' | 'unpublish' | 'takedown'

export async function moderateContent(contentId: string, action: ModerationAction, rejectionReason?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未ログインです' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: '権限がありません' }

  const patch: Record<string, unknown> = {}
  if (action === 'approve') {
    patch.review_status = 'approved'
    patch.is_published = true
    patch.rejection_reason = null
    // v56: 却下された商品はクリエイター側から再公開できないよう requires_admin_review を
    // 立てている。その旗を降ろせるのは管理者の承認だけ（＝ここが唯一の復帰経路）。
    patch.requires_admin_review = false
  } else if (action === 'reject') {
    // 監査で発覚: 却下理由を入力する欄自体が無く、クリエイターに一切理由が伝わらなかった
    // （本人確認の却下(identity_rejection_reason)と非対称だった）。他のadmin自由入力欄
    // (identity却下・comment_reports・invite note等)と同じくsanitizeText経由に統一。
    const reason = sanitizeText(rejectionReason, { maxLength: 500, allowNewlines: true })
    if (reason.length < 3) return { error: '却下理由を入力してください' }
    patch.review_status = 'rejected'
    patch.is_published = false
    patch.rejection_reason = reason
    // 以後クリエイターが自力で販売再開できないようにする（再開には運営の承認が必要）
    patch.requires_admin_review = true
  } else if (action === 'unpublish') {
    patch.is_published = false
  } else if (action === 'takedown') {
    const reason = sanitizeText(rejectionReason, { maxLength: 500, allowNewlines: true })
    if (reason.length < 3) return { error: '配信停止の理由を入力してください' }
    patch.review_status = 'rejected'
    patch.is_published = false
    patch.rejection_reason = reason
    patch.requires_admin_review = true
    // 購入済みの人のダウンロードも止める
    patch.hard_takedown = true
    patch.takedown_reason = reason
    patch.takedown_at = new Date().toISOString()
    patch.takedown_by = user.id
  }

  const { data: updated, error } = await supabase.from('contents').update(patch).eq('id', contentId).select('id')
  if (error) return { error: error.message }
  if (!updated || updated.length === 0) {
    // RLSに阻まれた0行更新はSupabaseがエラーを返さないため、ここで明示的に検知する
    // （v31のcontents_updateポリシー不備で実際に起きていた失敗パターン。v36で修正済みだが
    // 将来同種の穴が再発しても「成功したように見えて何も変わらない」を防ぐ防御）。
    return { error: '更新対象が見つからないか、権限がありません' }
  }

  // 審査結果をクリエイターに通知する。
  // これまで承認/却下/配信停止が一切通知されず、クリエイターはダッシュボードを
  // 開くまで自分の商品が販売停止になったことに気づけなかった。
  // notifications は service_role でしか insert できない（RLSにINSERTポリシーが無い）。
  try {
    const admin = createAdminClient()
    const { data: target } = await admin.from('contents').select('creator_id, title').eq('id', contentId).maybeSingle()
    if (target?.creator_id) {
      const notice =
        action === 'approve'   ? { type: 'content_approved',  title: '出品が承認されました',   body: `「${target.title}」が承認されました。` }
        : action === 'reject'  ? { type: 'content_rejected',  title: '出品が却下されました',   body: `「${target.title}」の販売を停止しました。理由: ${patch.rejection_reason}` }
        : action === 'takedown'? { type: 'content_takedown',  title: '配信を停止しました',     body: `「${target.title}」は法令違反のため配信を停止しました。理由: ${patch.rejection_reason}` }
        : { type: 'content_unpublished', title: '出品を非公開にしました', body: `「${target.title}」を運営が非公開にしました。` }
      const { error: notifErr } = await admin.from('notifications').insert({
        user_id: target.creator_id,
        type: notice.type,
        title: notice.title,
        body: notice.body,
        link: '/creator/dashboard',
      })
      if (notifErr) console.error('[moderateContent] notification insert failed:', notifErr.message)
    }
  } catch (e) {
    console.error('[moderateContent] notification failed:', e)
  }

  // 監査ログ（監査で発覚: 他の全admin書き込み経路はadmin_actionsに記録しているのに
  // このコンテンツ承認/却下だけが記録されておらず、/admin/auditで追跡できなかった）
  const { error: auditErr } = await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action_type: `content_${action}`,
    target_type: 'content',
    target_id: contentId,
  })
  if (auditErr) console.error('[moderateContent] admin_actions insert failed:', auditErr.message)

  revalidatePath('/admin/contents')
  revalidatePath('/contents')
  return { ok: true }
}
