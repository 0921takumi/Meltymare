const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toJstParts(value: Date): string {
  const jst = new Date(value.getTime() + JST_OFFSET_MS)
  return [
    jst.getUTCFullYear(),
    '-',
    pad2(jst.getUTCMonth() + 1),
    '-',
    pad2(jst.getUTCDate()),
    'T',
    pad2(jst.getUTCHours()),
    ':',
    pad2(jst.getUTCMinutes()),
  ].join('')
}

export function parseFutureSaleStart(value: string, now = new Date()): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('販売開始日時を入力してください')
  if (!DATE_TIME_LOCAL_PATTERN.test(normalized)) {
    throw new Error('販売開始日時が正しくありません')
  }

  // datetime-local has no time-zone information. Interpret it as fixed JST
  // instead of relying on the browser/server's local time zone.
  const saleStartsAt = new Date(`${normalized}:00.000+09:00`)
  if (Number.isNaN(saleStartsAt.getTime()) || toJstParts(saleStartsAt) !== normalized) {
    throw new Error('販売開始日時が正しくありません')
  }
  if (saleStartsAt.getTime() <= now.getTime()) {
    throw new Error('販売開始日時は現在より後に設定してください')
  }

  return saleStartsAt.toISOString()
}

export function toJstDateTimeLocalValue(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : toJstParts(date)
}

export function hasSaleStarted(saleStartsAt: string | null | undefined, now = new Date()): boolean {
  if (!saleStartsAt) return false
  const startMs = new Date(saleStartsAt).getTime()
  return Number.isFinite(startMs) && Number.isFinite(now.getTime()) && startMs <= now.getTime()
}

export function isSaleScheduled(saleStartsAt: string | null | undefined, now = new Date()): boolean {
  if (!saleStartsAt) return false
  const startMs = new Date(saleStartsAt).getTime()
  return Number.isFinite(startMs) && Number.isFinite(now.getTime()) && startMs > now.getTime()
}

export function resolveSaleStartsAt(options: {
  timing: 'now' | 'scheduled'
  existingSaleStartsAt: string | null | undefined
  hasBeenOnSale: boolean
  scheduledLocalValue: string
  now?: Date
}): string {
  const now = options.now ?? new Date()
  if (options.timing === 'scheduled') {
    const unchangedExistingSchedule = !!options.existingSaleStartsAt
      && options.scheduledLocalValue.trim() === toJstDateTimeLocalValue(options.existingSaleStartsAt)
    if (unchangedExistingSchedule && hasSaleStarted(options.existingSaleStartsAt, now)) {
      return options.existingSaleStartsAt as string
    }
    if (options.hasBeenOnSale) {
      throw new Error('販売開始済みの商品は予約し直せません')
    }
    return parseFutureSaleStart(options.scheduledLocalValue, now)
  }

  if (options.hasBeenOnSale && hasSaleStarted(options.existingSaleStartsAt, now)) {
    return options.existingSaleStartsAt as string
  }

  return now.toISOString()
}
