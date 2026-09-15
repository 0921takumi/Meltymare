import { describe, it, expect } from 'vitest'
import { apiErrorMessage } from './api-error'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('apiErrorMessage: 失敗した API の理由を利用者に見える日本語にする', () => {
  it('既知のコードは説明文になる（今回の不具合: 本人確認未承認で昇格が拒否されていた）', async () => {
    const msg = await apiErrorMessage(json(403, {
      error: 'identity_not_approved',
      detail: '本人確認が承認されていないユーザーはクリエイターにできません。先に本人確認ページで承認してください',
    }))
    expect(msg).toContain('本人確認が承認されていない')
    expect(msg).toContain('自動でクリエイターになります')
  })

  it('未知のコードでも API の detail があればそれを出す', async () => {
    expect(await apiErrorMessage(json(400, { error: 'something_new', detail: '入力が長すぎます' }))).toBe('入力が長すぎます')
  })

  it('detail が無ければ message を出す', async () => {
    expect(await apiErrorMessage(json(403, { error: 'x', message: 'このアカウントは現在ご利用いただけません' })))
      .toBe('このアカウントは現在ご利用いただけません')
  })

  it('本文が JSON でなくても落ちず、ステータスに応じた文言になる', async () => {
    expect(await apiErrorMessage(new Response('<html>502</html>', { status: 401 }))).toContain('ログイン')
    expect(await apiErrorMessage(new Response('', { status: 429 }))).toContain('少し待って')
    expect(await apiErrorMessage(new Response('oops', { status: 500 }), '保存に失敗しました')).toBe('保存に失敗しました（エラー 500）')
  })

  it('空文字にはならない（画面に何も出ない＝「反応しない」を再発させない）', async () => {
    for (const r of [json(500, {}), json(400, { error: '' }), new Response(null, { status: 503 })]) {
      const msg = await apiErrorMessage(r)
      expect(msg.trim().length).toBeGreaterThan(0)
    }
  })

  it('レスポンス本文を消費しない（呼び出し側が後から読める）', async () => {
    const r = json(400, { error: 'invalid' })
    await apiErrorMessage(r)
    expect(await r.json()).toEqual({ error: 'invalid' })
  })
})
