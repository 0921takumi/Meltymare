/**
 * サムネイル加工（文字入れ・ぼかし）の座標計算。
 *
 * 描画そのものは canvas に依存するが、位置計算はここに切り出して単体テストできるようにする。
 * 2026-08 に「ぼかしがうまくできない」報告があり、原因は以下2つの計算ミスだった:
 *   1. ドラッグ中に起点座標そのものを更新していたため、左・上方向へなぞると範囲が壊れる
 *   2. canvas に object-fit:contain を掛けていたため、縦長画像で表示枠に余白が入り、
 *      なぞった位置とぼかす位置がズレる
 */

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/**
 * ドラッグ開始点と現在点から矩形を作る。
 * 必ず「開始点(anchor)」を渡すこと。前フレームの矩形を渡すと起点が失われて範囲が壊れる。
 */
export function rectFrom(anchor: Point, point: Point): Rect {
  return {
    x: Math.min(anchor.x, point.x),
    y: Math.min(anchor.y, point.y),
    w: Math.abs(point.x - anchor.x),
    h: Math.abs(point.y - anchor.y),
  }
}

/**
 * 画面上の座標を画像の実ピクセル座標へ変換する。
 * canvas は縦横比そのままで表示する前提（object-fit で余白を作らないこと）。
 */
export function toImageCoords(
  displayRect: { left: number; top: number; width: number; height: number },
  canvasW: number,
  canvasH: number,
  clientX: number,
  clientY: number,
): Point {
  return {
    x: Math.max(0, Math.min(canvasW, (clientX - displayRect.left) * (canvasW / displayRect.width))),
    y: Math.max(0, Math.min(canvasH, (clientY - displayRect.top) * (canvasH / displayRect.height))),
  }
}

/** ぼかしの強さ（作業用画像の幅に対する比率）。CSS の blur(35px) 相当を 1600px 幅で得る。 */
export function blurRadiusFor(workWidth: number): number {
  return Math.max(6, Math.round(workWidth * 0.022))
}

/**
 * RGBA ピクセル配列をその場でぼかす（分離型ボックスブラー×passes回 ≈ ガウスぼかし）。
 *
 * 2026-09 に「やはりぼかしがうまくいかない」と再報告があった。前回の座標修正後も残った原因は
 * canvas の `ctx.filter = 'blur()'` で、Safari（iPhone/iPad/Mac）が長く未対応のため
 * **黙って無視され、範囲を選んでも何も変わらない**。ピクセル演算ならどのブラウザでも同じ結果になる。
 * 端は最寄りのピクセルで埋める（clamp）。radius=0 なら何もしない。
 */
export function boxBlurRGBA(data: Uint8ClampedArray, w: number, h: number, radius: number, passes = 3): void {
  const r = Math.max(0, Math.round(radius))
  if (r === 0 || w < 1 || h < 1 || data.length < w * h * 4) return
  const tmp = new Uint8ClampedArray(data.length)
  for (let p = 0; p < passes; p++) {
    blurHorizontal(data, tmp, w, h, r)
    blurVertical(tmp, data, w, h, r)
  }
}

function blurHorizontal(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number): void {
  const div = 2 * r + 1
  const last = w - 1
  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    let sr = 0, sg = 0, sb = 0, sa = 0
    for (let k = -r; k <= r; k++) {
      const i = row + Math.min(last, Math.max(0, k)) * 4
      sr += src[i]; sg += src[i + 1]; sb += src[i + 2]; sa += src[i + 3]
    }
    for (let x = 0; x < w; x++) {
      const o = row + x * 4
      dst[o] = sr / div; dst[o + 1] = sg / div; dst[o + 2] = sb / div; dst[o + 3] = sa / div
      const ai = row + Math.min(last, x + r + 1) * 4
      const si = row + Math.max(0, x - r) * 4
      sr += src[ai] - src[si]; sg += src[ai + 1] - src[si + 1]; sb += src[ai + 2] - src[si + 2]; sa += src[ai + 3] - src[si + 3]
    }
  }
}

function blurVertical(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number): void {
  const div = 2 * r + 1
  const last = h - 1
  const stride = w * 4
  for (let x = 0; x < w; x++) {
    const col = x * 4
    let sr = 0, sg = 0, sb = 0, sa = 0
    for (let k = -r; k <= r; k++) {
      const i = col + Math.min(last, Math.max(0, k)) * stride
      sr += src[i]; sg += src[i + 1]; sb += src[i + 2]; sa += src[i + 3]
    }
    for (let y = 0; y < h; y++) {
      const o = col + y * stride
      dst[o] = sr / div; dst[o + 1] = sg / div; dst[o + 2] = sb / div; dst[o + 3] = sa / div
      const ai = col + Math.min(last, y + r + 1) * stride
      const si = col + Math.max(0, y - r) * stride
      sr += src[ai] - src[si]; sg += src[ai + 1] - src[si + 1]; sb += src[ai + 2] - src[si + 2]; sa += src[ai + 3] - src[si + 3]
    }
  }
}

/** 作業用画像の最大辺。スマホ写真(3000〜4000px)のまま毎フレームぼかすと操作が固まるため縮小する。 */
export const WORK_MAX_PX = 1600

/** 元画像サイズから作業用サイズを求める（縦横比は維持） */
export function workSize(naturalW: number, naturalH: number, max = WORK_MAX_PX): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(naturalW, naturalH))
  return {
    w: Math.max(1, Math.round(naturalW * scale)),
    h: Math.max(1, Math.round(naturalH * scale)),
  }
}
