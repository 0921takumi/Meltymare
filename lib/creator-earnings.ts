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
  // hard_takedown は v57 で追加した列。未適用のDBに対しても集計が落ちないようにする
  // （落ちると管理画面の振込予定額が丸ごと表示できなくなる）。
  const SEL_WITH_TAKEDOWN = 'content_price, amount, tip_amount, fee_rate, content:contents(creator_id, hard_takedown, creator:profiles(fee_rate))'
  const SEL_FALLBACK = 'content_price, amount, tip_amount, fee_rate, content:contents(creator_id, creator:profiles(fee_rate))'
  const load = (sel: string) => fetchAllRows((from, to) => supabase
    .from('purchases')
    .select(sel)
    .eq('status', 'completed')
    .is('payout_id', null)
    .range(from, to))
  let purchases: any[]
  try {
    purchases = await load(SEL_WITH_TAKEDOWN)
  } catch (e) {
    console.warn('[creator-earnings] hard_takedown 列が未適用の可能性:', (e as Error).message)
    purchases = await load(SEL_FALLBACK)
  }

  const byCreator: Record<string, CreatorEarnings> = {}
  for (const p of purchases as any[]) {
    const creatorId = p.content?.creator_id
    if (!creatorId) continue
    // 法令違反で配信停止した商品の売上は振込対象にしない。
    // 購入者への返金対応が前提の状態でクリエイターに支払うと二重の損失になる。
    if (p.content?.hard_takedown) continue
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
