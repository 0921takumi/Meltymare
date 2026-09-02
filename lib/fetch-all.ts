/**
 * PostgREST のデフォルト行数上限（未設定時は通常1000）により、全件前提の集計
 * （振込予定額・売上合計等）が対象行数がそれを超えた瞬間にエラーも出さず無言で
 * 切り捨てられる問題への対応。.range() でページングしながら空ページになるまで
 * 全件取得する。
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) {
      // PostgREST のエラーコード(42703=列が無い 等)を呼び出し側が判別できるよう残す。
      // 落とすと「列未適用のフォールバック」が RLS 拒否やネットワーク断でも発火してしまう。
      const err = new Error(error.message) as Error & { code?: string }
      err.code = error.code
      throw err
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
