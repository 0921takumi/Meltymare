import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 出金ステータス変更（管理者専用）
 *
 * 背景: payouts には UPDATE の RLS ポリシーが無く、管理画面からのクライアント直
 *   update は 0 行更新でサイレント失敗していた（出金ステータスが保存されない）。
 *   admin client に集約し、role 確認のうえ更新＋監査ログを残す。
 */

const UUID_RE = /^[0-9a-f-]{36}$/i
const ALLOWED = ['pending', 'processing', 'completed', 'failed']

const admin = createAdminClient()

export async function PATCH(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { user } = ctx

  const body = await req.json().catch(() => ({}))
  const payoutId = body?.payout_id
  const status = body?.status
  if (typeof payoutId !== 'string' || !UUID_RE.test(payoutId)) {
    return NextResponse.json({ error: 'invalid_payout' }, { status: 400 })
  }
  if (typeof status !== 'string' || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  // v41: completed→pending/failed の逆遷移時に purchases/tips の payout_id を解除するため、
  // 更新前の status を確認しておく（誤操作や振込失敗の巻き戻しで、実際は未振込なのに
  // 「支払済み」として振込予定額の集計から永久に消えてしまうのを防ぐ）。
  const { data: before } = await admin.from('payouts').select('status').eq('id', payoutId).maybeSingle()
  const wasCompleted = before?.status === 'completed'

  const update: Record<string, unknown> = { status }
  if (status === 'completed') update.paid_at = new Date().toISOString()

  const { data: payoutRow, error } = await admin.from('payouts').update(update).eq('id', payoutId).select('creator_id, period_start, period_end, net_amount').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (wasCompleted && status !== 'completed') {
    const { error: unlinkPurchaseErr } = await admin.from('purchases').update({ payout_id: null }).eq('payout_id', payoutId)
    if (unlinkPurchaseErr) console.error('[admin-payout] purchases unlink failed:', unlinkPurchaseErr.message, 'payout:', payoutId)
    const { error: unlinkTipErr } = await admin.from('tips').update({ payout_id: null }).eq('payout_id', payoutId)
    if (unlinkTipErr) console.error('[admin-payout] tips unlink failed:', unlinkTipErr.message, 'payout:', payoutId)
  }

  // v29: 振込が completed に確定したら、対象クリエイターの未精算購入(payout_id is null,
  // status='completed')にこの payout_id を一括で紐付ける。これが無いと、振込後も
  // ダッシュボード/管理画面の「振込予定額」が同じ額を永遠に表示し続けてしまう
  // （payout_id is null の分だけを未払いとして集計しているため）。
  // 既に紐付け済みの購入は対象外(payout_id is null 条件)なので、同じ payout を複数回
  // completed にしても二重に紐付くことはない。
  //
  // v36: period_start/period_end で絞り込まずに紐付けていたため、この振込の対象期間より
  // 「後」に発生した購入まで一緒に紐付いてしまい、後日別の振込を作った際にその購入が
  // 二重計上されない代わりに「もう払われたことになっている」と誤認される恐れがあった
  // （period_endはDATEなのでその日の終わりまでを含めるよう23:59:59.999まで許容する）。
  // v49: net_amount は payouts 行作成時に手入力される値で、実際に紐付いた
  // purchases/tips の合計と突き合わせる仕組みが一切無かった（入力ミス・期間の
  // 取り違え等があっても気づく手段が無い）。紐付け結果を集計してnet_amountと比較し、
  // 不一致なら監査ログに残す（自動修正はしない＝金額を勝手に書き換えない）。
  let linkedTotal = 0
  if (status === 'completed' && payoutRow?.creator_id) {
    const { data: creatorContents } = await admin.from('contents').select('id').eq('creator_id', payoutRow.creator_id)
    const contentIds = (creatorContents ?? []).map(c => c.id)
    if (contentIds.length > 0) {
      let linkQuery = admin.from('purchases')
        .update({ payout_id: payoutId })
        .in('content_id', contentIds)
        .is('payout_id', null)
        .eq('status', 'completed')
      if (payoutRow.period_start) linkQuery = linkQuery.gte('created_at', payoutRow.period_start)
      if (payoutRow.period_end) linkQuery = linkQuery.lte('created_at', `${payoutRow.period_end}T23:59:59.999Z`)
      else console.warn('[admin-payout] payout has no period_end, linking without upper bound:', payoutId)
      const { data: linkedPurchases, error: linkErr } = await linkQuery.select('amount')
      if (linkErr) console.error('[admin-payout] purchases payout_id linkage failed:', linkErr.message, 'payout:', payoutId)
      linkedTotal += (linkedPurchases ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
    }

    // v40: 単発チップ(tips)も同じ振込に紐付ける。tips は creator_id を直接持つため
    // contents 経由の絞り込みは不要。期間境界は tips.created_at で揃える。
    let tipLink = admin.from('tips')
      .update({ payout_id: payoutId })
      .eq('creator_id', payoutRow.creator_id)
      .is('payout_id', null)
      .eq('status', 'completed')
    if (payoutRow.period_start) tipLink = tipLink.gte('created_at', payoutRow.period_start)
    if (payoutRow.period_end) tipLink = tipLink.lte('created_at', `${payoutRow.period_end}T23:59:59.999Z`)
    const { data: linkedTips, error: tipLinkErr } = await tipLink.select('amount')
    if (tipLinkErr) console.error('[admin-payout] tips payout_id linkage failed:', tipLinkErr.message, 'payout:', payoutId)
    linkedTotal += (linkedTips ?? []).reduce((s, t) => s + (t.amount ?? 0), 0)

    const netAmount = payoutRow.net_amount ?? 0
    if (linkedTotal !== netAmount) {
      console.error(
        '[admin-payout] RECONCILIATION MISMATCH: net_amount(手入力)と実際に紐付いた購入/チップ合計が不一致。手入力ミスまたは期間指定の誤りの可能性。要目視確認。',
        'payout:', payoutId, 'net_amount:', netAmount, 'linked_total:', linkedTotal,
      )
      await admin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'payout.reconciliation_mismatch',
        target_type: 'payout',
        target_id: payoutId,
        metadata: { net_amount: netAmount, linked_total: linkedTotal, diff: linkedTotal - netAmount },
      })
    }
  }

  // 監査ログ（service_role で記録）
  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action_type: 'payout_status_change',
    target_type: 'payout',
    target_id: payoutId,
    detail: { status },
  })

  // v47で発覚: 振込ステータス変更(completed/failed含む)がクリエイターに一切通知されず、
  // 特にfailedになっても自分から気づく手段が無かった。
  if (payoutRow?.creator_id) {
    const netYen = (payoutRow.net_amount ?? 0).toLocaleString()
    const notif = status === 'completed'
      ? { title: '振込が完了しました', body: `¥${netYen} のお振込が完了しました。` }
      : status === 'failed'
        ? { title: '振込に失敗しました', body: 'お振込が失敗しました。口座情報をご確認のうえ、サポートまでお問い合わせください。' }
        : status === 'processing'
          ? { title: '振込処理を開始しました', body: `¥${netYen} のお振込処理を開始しました。` }
          : null
    if (notif) {
      const { error: payoutNotifErr } = await admin.from('notifications').insert({
        user_id: payoutRow.creator_id,
        type: 'payout',
        title: notif.title,
        body: notif.body,
        link: '/creator/dashboard',
      })
      if (payoutNotifErr) console.error('[admin-payout] creator notification insert failed:', payoutNotifErr.message, 'payout:', payoutId)
    }
  }

  return NextResponse.json({ ok: true })
}
