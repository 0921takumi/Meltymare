/**
 * 生年月日(日付のみ文字列 "YYYY-MM-DD")からの満年齢を、日本(JST)の暦日基準で算出する。
 *
 * なぜ専用関数か:
 *   `new Date("YYYY-MM-DD")` は UTC 00:00 と解釈される一方、getFullYear/getMonth/getDate は
 *   実行環境のローカルTZ getter のため、両者を混ぜると環境TZ次第で誕生日当日±1日のズレが出る。
 *   これは 18歳判定(年齢確認)という法的に重要な分岐を1日誤らせ得る(@legal×@security GO の修正)。
 *
 * 方針:
 *   - birthdate 側は getUTC* で「保存された暦日」をそのまま読む。
 *   - 比較する「今日」は年齢確認の基準地=日本の暦日(Asia/Tokyo)で固定する
 *     （現在日まで UTC にすると JST 深夜帯=UTC前日 で別のズレが残るため）。
 *
 *   ⚠️ 年齢確認の表示(admin)と登録ゲート(creator/verification)は必ずこの同一関数を使い、
 *      ロジックを二度と分岐させないこと。
 */
export function calcAgeJST(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return null
  const todayJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  let age = todayJST.getFullYear() - b.getUTCFullYear()
  const m = todayJST.getMonth() - b.getUTCMonth()
  if (m < 0 || (m === 0 && todayJST.getDate() < b.getUTCDate())) age--
  return age
}

/** 満18歳以上か。年齢確認ゲート・表示の唯一の判定経路。 */
export function isAdult(birthdate: string | null | undefined): boolean {
  const age = calcAgeJST(birthdate)
  return age !== null && age >= 18
}
