import { describe, it, expect } from 'vitest'
import { rectFrom, toImageCoords, workSize } from './thumbnail-edit'

describe('rectFrom: ドラッグ範囲の計算', () => {
  const anchor = { x: 100, y: 100 }

  it('右下へなぞった範囲を正しく作る', () => {
    expect(rectFrom(anchor, { x: 180, y: 160 })).toEqual({ x: 100, y: 100, w: 80, h: 60 })
  })

  it('左上へなぞっても範囲が作れる（報告のあった不具合の本体）', () => {
    expect(rectFrom(anchor, { x: 40, y: 30 })).toEqual({ x: 40, y: 30, w: 60, h: 70 })
  })

  it('起点を固定していれば、連続したドラッグでも範囲が縮んでいかない', () => {
    // 旧実装は前フレームの矩形を起点として再計算していたため、
    // 左方向へ動かすたびに起点が現在地へずり落ちて範囲が壊れていた。
    let r = rectFrom(anchor, { x: 90, y: 90 })
    r = rectFrom(anchor, { x: 70, y: 60 })
    r = rectFrom(anchor, { x: 50, y: 40 })
    expect(r).toEqual({ x: 50, y: 40, w: 50, h: 60 })
  })

  it('旧実装（前フレームの矩形を起点にする）を再現すると範囲が壊れることを示す', () => {
    // 回帰の再発を検知するための対比。前フレーム矩形を anchor として渡すと、
    // 3回動かしただけで本来 50x60 の範囲が別物になる。
    let broken = rectFrom(anchor, { x: 90, y: 90 })
    broken = rectFrom({ x: broken.x, y: broken.y }, { x: 70, y: 60 })
    broken = rectFrom({ x: broken.x, y: broken.y }, { x: 50, y: 40 })
    expect(broken).not.toEqual({ x: 50, y: 40, w: 50, h: 60 })
  })
})

describe('toImageCoords: 表示座標→画像座標', () => {
  // 900x1200 の縦長画像を、幅380pxで表示（高さは縦横比なりに 506.67px）
  const canvasW = 900, canvasH = 1200
  const display = { left: 20, top: 50, width: 380, height: 380 * (1200 / 900) }

  it('表示の中心が画像の中心に対応する', () => {
    const p = toImageCoords(display, canvasW, canvasH, 20 + 190, 50 + display.height / 2)
    expect(Math.round(p.x)).toBe(450)
    expect(Math.round(p.y)).toBe(600)
  })

  it('左上・右下の角が画像の角に対応する', () => {
    const tl = toImageCoords(display, canvasW, canvasH, 20, 50)
    expect([Math.round(tl.x), Math.round(tl.y)]).toEqual([0, 0])
    const br = toImageCoords(display, canvasW, canvasH, 20 + 380, 50 + display.height)
    expect([Math.round(br.x), Math.round(br.y)]).toEqual([900, 1200])
  })

  it('枠外へはみ出しても画像内に収まる', () => {
    const p = toImageCoords(display, canvasW, canvasH, -500, 99999)
    expect(p).toEqual({ x: 0, y: 1200 })
  })

  it('object-fit:contain で余白ができる表示枠だと座標がズレる（旧実装の不具合）', () => {
    // 旧実装は maxHeight:240 + object-fit:contain のため、380x240 の枠の中に
    // 実際の画像は 180x240 で中央寄せされ、左右に100pxずつ余白ができていた。
    const boxed = { left: 20, top: 50, width: 380, height: 240 }
    // 画像の左端(表示上は left+100)をなぞったつもりでも…
    const p = toImageCoords(boxed, canvasW, canvasH, 20 + 100, 50 + 120)
    // …余白を考慮しないため x=0 ではなく画像の1/4付近を指してしまう
    expect(Math.round(p.x)).toBe(237)
    expect(Math.round(p.x)).not.toBe(0)
  })
})

describe('workSize: 作業用画像の縮小', () => {
  it('スマホ写真は最大辺1600pxに収まる', () => {
    expect(workSize(3024, 4032)).toEqual({ w: 1200, h: 1600 })
  })
  it('横長でも最大辺基準で縮小する', () => {
    expect(workSize(4032, 3024)).toEqual({ w: 1600, h: 1200 })
  })
  it('小さい画像は拡大しない', () => {
    expect(workSize(800, 600)).toEqual({ w: 800, h: 600 })
  })
})
