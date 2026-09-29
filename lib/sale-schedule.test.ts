import { describe, expect, it } from 'vitest'
import {
  hasSaleStarted,
  isSaleScheduled,
  parseFutureSaleStart,
  resolveSaleStartsAt,
  toJstDateTimeLocalValue,
} from './sale-schedule'

describe('sale schedule', () => {
  it('converts a JST datetime-local value to the UTC ISO value stored in Supabase', () => {
    const result = parseFutureSaleStart(
      '2026-09-30T20:00',
      new Date('2026-09-26T00:00:00.000Z'),
    )

    expect(result).toBe('2026-09-30T11:00:00.000Z')
  })

  it('restores a stored UTC ISO value as the same JST datetime-local value', () => {
    expect(toJstDateTimeLocalValue('2026-09-30T11:00:00.000Z')).toBe('2026-09-30T20:00')
  })

  it('rejects an empty scheduled start', () => {
    expect(() => parseFutureSaleStart('', new Date('2026-09-26T00:00:00.000Z')))
      .toThrow('販売開始日時を入力してください')
  })

  it('rejects a calendar date that does not exist', () => {
    expect(() => parseFutureSaleStart('2026-02-30T20:00', new Date('2026-01-01T00:00:00.000Z')))
      .toThrow('販売開始日時が正しくありません')
  })

  it('rejects a scheduled start that is not in the future', () => {
    expect(() => parseFutureSaleStart('2026-09-26T09:00', new Date('2026-09-26T00:00:00.000Z')))
      .toThrow('販売開始日時は現在より後に設定してください')
  })

  it('treats the exact scheduled instant as sale started', () => {
    const start = '2026-09-30T11:00:00.000Z'

    expect(hasSaleStarted(start, new Date('2026-09-30T10:59:59.999Z'))).toBe(false)
    expect(hasSaleStarted(start, new Date('2026-09-30T11:00:00.000Z'))).toBe(true)
  })

  it('fails closed when the stored sale start is missing or invalid', () => {
    expect(hasSaleStarted(null, new Date('2026-09-30T11:00:00.000Z'))).toBe(false)
    expect(hasSaleStarted('not-a-date', new Date('2026-09-30T11:00:00.000Z'))).toBe(false)
  })

  it('reports only future starts as scheduled', () => {
    const now = new Date('2026-09-30T11:00:00.000Z')

    expect(isSaleScheduled('2026-09-30T11:00:00.001Z', now)).toBe(true)
    expect(isSaleScheduled('2026-09-30T11:00:00.000Z', now)).toBe(false)
  })

  it('preserves the original start when editing an already-started sale', () => {
    expect(resolveSaleStartsAt({
      timing: 'now',
      existingSaleStartsAt: '2026-09-20T03:00:00.000Z',
      hasBeenOnSale: true,
      scheduledLocalValue: '',
      now: new Date('2026-09-26T00:00:00.000Z'),
    })).toBe('2026-09-20T03:00:00.000Z')
  })

  it('uses now for the first publication of an older draft', () => {
    expect(resolveSaleStartsAt({
      timing: 'now',
      existingSaleStartsAt: '2026-09-20T03:00:00.000Z',
      hasBeenOnSale: false,
      scheduledLocalValue: '',
      now: new Date('2026-09-26T00:00:00.000Z'),
    })).toBe('2026-09-26T00:00:00.000Z')
  })

  it('uses the current instant when a future schedule is changed to immediate sale', () => {
    expect(resolveSaleStartsAt({
      timing: 'now',
      existingSaleStartsAt: '2026-09-30T11:00:00.000Z',
      hasBeenOnSale: false,
      scheduledLocalValue: '',
      now: new Date('2026-09-26T00:00:00.000Z'),
    })).toBe('2026-09-26T00:00:00.000Z')
  })

  it('validates and converts the selected scheduled time', () => {
    expect(resolveSaleStartsAt({
      timing: 'scheduled',
      existingSaleStartsAt: null,
      hasBeenOnSale: false,
      scheduledLocalValue: '2026-09-30T20:00',
      now: new Date('2026-09-26T00:00:00.000Z'),
    })).toBe('2026-09-30T11:00:00.000Z')
  })

  it('keeps an unchanged reservation when the edit form is submitted after the start boundary', () => {
    expect(resolveSaleStartsAt({
      timing: 'scheduled',
      existingSaleStartsAt: '2026-09-30T11:00:00.000Z',
      hasBeenOnSale: false,
      scheduledLocalValue: '2026-09-30T20:00',
      now: new Date('2026-09-30T11:00:00.001Z'),
    })).toBe('2026-09-30T11:00:00.000Z')
  })

  it('rejects a future reservation after a sale has already started', () => {
    expect(() => resolveSaleStartsAt({
      timing: 'scheduled',
      existingSaleStartsAt: '2026-09-20T03:00:00.000Z',
      hasBeenOnSale: true,
      scheduledLocalValue: '2026-09-30T20:00',
      now: new Date('2026-09-26T00:00:00.000Z'),
    })).toThrow('販売開始済みの商品は予約し直せません')
  })
})
