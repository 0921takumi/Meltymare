/**
 * PostgREST のデフォルト行数上限（未設定時は通常1000）により、全件前提の集計
 * （振込予定額・売上合計等）が対象行数がそれを超えた瞬間にエラーも出さず無言で
 * 切り捨てられる問題への対応。.range() でページングしながら空ページになるまで
 * 全件取得する。
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
