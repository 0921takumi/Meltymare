import { describe, it, expect } from 'vitest'
import { rectFrom, toImageCoords, workSize, boxBlurRGBA, blurRadiusFor, blurImageDataRGBA } from './thumbnail-edit'

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

describe('boxBlurRGBA: ctx.filter に頼らないピクセルぼかし（Safari対策）', () => {
  const solid = (w: number, h: number, rgba: [number, number, number, number]) => {
    const d = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) d.set(rgba, i * 4)
    return d
  }
  const edgeImage = (w: number, h: number) => {
    // 左半分が黒、右半分が白（アルファは255）
    const d = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? 0 : 255
      d.set([v, v, v, 255], (y * w + x) * 4)
    }
    return d
  }

  it('単色画像は変化しない', () => {
    const d = solid(8, 8, [200, 30, 60, 255])
    const before = Array.from(d)
    boxBlurRGBA(d, 8, 8, 3)
    expect(Array.from(d)).toEqual(before)
  })

  it('黒/白の境界がなだらかになる（境界の両側が中間値になり、遠くは元のまま）', () => {
    const w = 32, h = 4
    const d = edgeImage(w, h)
    boxBlurRGBA(d, w, h, 3)
    const px = (x: number) => d[(1 * w + x) * 4]
    expect(px(15)).toBeGreaterThan(0)
    expect(px(15)).toBeLessThan(255)
    expect(px(16)).toBeGreaterThan(0)
    expect(px(16)).toBeLessThan(255)
    expect(px(0)).toBe(0)
    expect(px(31)).toBe(255)
    for (let x = 1; x < w; x++) expect(px(x)).toBeGreaterThanOrEqual(px(x - 1))
  })

  it('ぼかしを当てないと境界は鋭いまま（テストが no-op を検知できることの確認）', () => {
    const w = 32, h = 4
    const d = edgeImage(w, h)
    expect(d[(1 * w + 15) * 4]).toBe(0)
    expect(d[(1 * w + 16) * 4]).toBe(255)
  })

  it('アルファは 255 のまま保たれる', () => {
    const w = 16, h = 8
    const d = edgeImage(w, h)
    boxBlurRGBA(d, w, h, 4)
    for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(255)
  })

  it('radius=0 なら何もしない／1x1 でも落ちない／配列長は変わらない', () => {
    const d = edgeImage(16, 4)
    const before = Array.from(d)
    boxBlurRGBA(d, 16, 4, 0)
    expect(Array.from(d)).toEqual(before)
    const one = solid(1, 1, [10, 20, 30, 255])
    boxBlurRGBA(one, 1, 1, 5)
    expect(Array.from(one)).toEqual([10, 20, 30, 255])
    expect(d.length).toBe(16 * 4 * 4)
  })

  it('ぼかし強度は幅に比例し、下限は 6px', () => {
    expect(blurRadiusFor(1600)).toBe(35)
    expect(blurRadiusFor(100)).toBe(6)
  })
})

describe('blurImageDataRGBA: 透過PNGでも縁が汚れない（プリマルチプライ）', () => {
  // 左半分が完全透明、右半分が不透明な白。ぼかすと境界に半透明の白が並ぶべきで、
  // 「暗い灰色」が出てはいけない（透明画素のRGB=0 を素で平均すると黒が混ざる）。
  const halfTransparentWhite = (w: number, h: number) => {
    const d = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (x >= w / 2) d.set([255, 255, 255, 255], i)
    }
    return d
  }
  const w = 32, h = 4, R = 3
  const rgbAt = (d: Uint8ClampedArray, x: number) => [d[(1 * w + x) * 4], d[(1 * w + x) * 4 + 1], d[(1 * w + x) * 4 + 2]]
  const alphaAt = (d: Uint8ClampedArray, x: number) => d[(1 * w + x) * 4 + 3]

  it('境界の半透明画素の色は白のまま（黒いにじみが出ない）', () => {
    const d = halfTransparentWhite(w, h)
    blurImageDataRGBA(d, w, h, R)
    for (let x = 12; x <= 20; x++) {
      if (alphaAt(d, x) < 8) continue
      for (const c of rgbAt(d, x)) expect(c).toBeGreaterThan(240)
    }
  })

  it('素の boxBlurRGBA だと同じ場所が暗くなる（プリマルチプライが効いていることの裏取り）', () => {
    const d = halfTransparentWhite(w, h)
    boxBlurRGBA(d, w, h, R)
    const darkened = [12, 13, 14, 15, 16].some(x => rgbAt(d, x).some(c => c < 200))
    expect(darkened).toBe(true)
  })

  it('アルファは滑らかに 0→255 へ増える', () => {
    const d = halfTransparentWhite(w, h)
    blurImageDataRGBA(d, w, h, R)
    expect(alphaAt(d, 0)).toBe(0)
    expect(alphaAt(d, 31)).toBe(255)
    for (let x = 1; x < w; x++) expect(alphaAt(d, x)).toBeGreaterThanOrEqual(alphaAt(d, x - 1))
  })

  it('不透明画像では boxBlurRGBA と同一結果', () => {
    const mk = () => {
      const d = new Uint8ClampedArray(w * h * 4)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = x < w / 2 ? 0 : 255
        d.set([v, v, 128, 255], (y * w + x) * 4)
      }
      return d
    }
    const a = mk(), b = mk()
    blurImageDataRGBA(a, w, h, R)
    boxBlurRGBA(b, w, h, R)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
