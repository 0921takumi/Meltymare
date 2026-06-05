import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * アンケートの票数集計（サーバー専用）。
 * poll_votes は RLS で個別票を非公開にしているため、集計は service_role で行う。
 * 返すのは「選択肢indexごとの票数」だけ（誰が投票したかは返さない＝プライバシー維持）。
 */
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * @param optionCounts poll_id → 選択肢の個数（票数配列の長さを決めるため）
 * @returns poll_id → 票数配列（index = 選択肢index）
 */
export async function getVoteCounts(
  optionCounts: Record<string, number>,
): Promise<Record<string, number[]>> {
  const pollIds = Object.keys(optionCounts)
  const result: Record<string, number[]> = {}
  for (const id of pollIds) result[id] = new Array(optionCounts[id]).fill(0)
  if (pollIds.length === 0) return result

  const { data, error } = await admin()
    .from('poll_votes')
    .select('poll_id, option_index')
    .in('poll_id', pollIds)

  // テーブル未作成などのエラー時はゼロ集計で返す（fail-safe）
  if (error || !data) return result

  for (const row of data as { poll_id: string; option_index: number }[]) {
    const arr = result[row.poll_id]
    if (arr && row.option_index >= 0 && row.option_index < arr.length) {
      arr[row.option_index]++
    }
  }
  return result
}
