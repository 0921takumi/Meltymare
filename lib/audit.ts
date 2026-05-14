/**
 * 監査ログ書き込みヘルパ。
 *
 * サーバー側で管理者・クリエイター操作などを `audit_logs` テーブルに記録する。
 * RLS は actor_id = auth.uid() を強制するので、必ず認証済みコンテキストから呼ぶこと。
 *
 * 使い方:
 *   await audit(supabase, {
 *     action: 'admin.user_suspend',
 *     targetType: 'user',
 *     targetId: userId,
 *     metadata: { reason: '...' }
 *   })
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuditEntry {
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}

export async function audit(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    // actor_id は RLS の WITH CHECK 句で auth.uid() に強制される
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return  // 認証外からは記録できない

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
    })
    if (error) {
      // ログ書き込みの失敗で本処理が止まるのは避けたい。エラーは記録のみ。
      console.error('[audit] failed to write audit log:', error.message)
    }
  } catch (e) {
    console.error('[audit] unexpected error:', e)
  }
}

/** よく使う action 名の定数（typo 防止用）。 */
export const AuditAction = {
  // クリエイター
  ContentCreate: 'content.create',
  ContentEdit: 'content.edit',
  ContentDelete: 'content.delete',
  ContentModerate: 'content.moderate',
  ContentPublish: 'content.publish',
  // 管理者
  AdminUserSuspend: 'admin.user_suspend',
  AdminUserUnsuspend: 'admin.user_unsuspend',
  AdminContentReject: 'admin.content_reject',
  AdminContentApprove: 'admin.content_approve',
  AdminPayout: 'admin.payout',
  AdminRoleChange: 'admin.role_change',
  AdminRefund: 'admin.refund',
  // 本人確認
  IdentitySubmit: 'identity.submit',
  IdentityApprove: 'identity.approve',
  IdentityReject: 'identity.reject',
} as const
