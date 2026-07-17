import { fetchAllRows } from '@/lib/fetch-all'
import { FINANCE } from '@/lib/config'

export interface CreatorEarnings {
  /** 未払い分の総売上（コンテンツ代金 + チップ） */
  sales: number
  /** 未払い分の手数料額（コンテンツ代金にのみ課金。チップは0%） */
  fee: number
  /** 未払い分の振込予定額（sales - fee と一致するよう構築） */
  net: number
}

/**
 * 全クリエイター分の「振込予定額」（未払い = payout_id 未設定の購入・チップのみ）を一括集計する。
 * admin/payouts と admin/creators で同じロジックを別々に実装した結果、後者が
 * contents.sold_count*price という古い計算のまま取り残されチップが一切反映されない
 * 事故が起きた(2026-07)。以後はここに一本化し、両画面から呼び出す。
 *
 * 手数料は購入完了時点の fee_rate スナップショットを優先し、無い場合のみ
 * creator の現在の fee_rate にフォールバックする（admin が手数料率を変更しても
 * 既に確定した過去の売上の手数料額が遡って変わらないようにするため）。
 */
export async function computePendingEarningsByCreator(
  supabase: any,
): Promise<Record<string, CreatorEarnings>> {
  const purchases = await fetchAllRows((from, to) => supabase
    .from('purchases')
    .select('content_price, amount, tip_amount, fee_rate, content:contents(creator_id, creator:profiles(fee_rate))')
    .eq('status', 'completed')
    .is('payout_id', null)
    .range(from, to))

  const byCreator: Record<string, CreatorEarnings> = {}
  for (const p of purchases as any[]) {
    const creatorId = p.content?.creator_id
    if (!creatorId) continue
    const feeRate = p.fee_rate ?? p.content?.creator?.fee_rate ?? FINANCE.defaultFeeRate
    const contentPrice = p.content_price ?? p.amount ?? 0
    const tip = p.tip_amount ?? 0
    const fee = Math.floor(contentPrice * feeRate / 100)
    if (!byCreator[creatorId]) byCreator[creatorId] = { sales: 0, fee: 0, net: 0 }
    byCreator[creatorId].sales += contentPrice + tip
    byCreator[creatorId].fee += fee
    byCreator[creatorId].net += (contentPrice - fee) + tip
  }

  // 単発チップ(tipsテーブル)も未払い分を加算。手数料0%で全額クリエイターへ。
  const tips = await fetchAllRows((from, to) => supabase
    .from('tips')
    .select('creator_id, amount')
    .eq('status', 'completed')
    .is('payout_id', null)
    .range(from, to))
  for (const t of tips as any[]) {
    const creatorId = t.creator_id
    if (!creatorId) continue
    const amt = t.amount ?? 0
    if (!byCreator[creatorId]) byCreator[creatorId] = { sales: 0, fee: 0, net: 0 }
    byCreator[creatorId].sales += amt
    byCreator[creatorId].net += amt
  }

  return byCreator
}
