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
