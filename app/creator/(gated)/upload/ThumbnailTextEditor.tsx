'use client'

import { useEffect, useRef, useState } from 'react'
import { Type, X, Droplet, Undo2 } from 'lucide-react'
import { rectFrom, toImageCoords as toImageCoordsPure, workSize, WORK_MAX_PX, blurImageDataRGBA, blurRadiusFor } from '@/lib/thumbnail-edit'

type VAlign = 'top' | 'middle' | 'bottom'
type HAlign = 'left' | 'center' | 'right'
type FontSize = 'small' | 'medium' | 'large'
type Mode = 'text' | 'blur'
/** ぼかし範囲。作業用画像の実ピクセル座標で保持する（表示倍率に依存させない） */
type BlurRect = import('@/lib/thumbnail-edit').Rect

const SIZE_RATIO: Record<FontSize, number> = { small: 0.045, medium: 0.07, large: 0.1 }

// canvasに画像+ぼかし+テキストを描画する共通ロジック（プレビューと最終書き出しの両方で使う）
/**
 * 元画像をまるごとぼかした「ぼかし版」を1回だけ作る。
 * 以後は選んだ範囲をここから写すだけなので、なぞっている最中も軽い。
 * canvas の ctx.filter は Safari(iPhone) が無視するため使わない（2026-09 の再報告の原因）。
 */
const BLUR_WORK_MAX_PX = 400

function makeBlurredCopy(base: HTMLCanvasElement): HTMLCanvasElement | null {
  // ぼかした絵に解像度は要らないので 1/4 程度に縮小して計算する（1600px幅で数秒→100ms未満）。
  // 描画時に元のサイズへ拡大しても、ぼかし面は滑らかなので見た目は変わらない。
  const { w, h } = workSize(base.width, base.height, BLUR_WORK_MAX_PX)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const dst = out.getContext('2d', { willReadFrequently: true })
  if (!dst) return null
  dst.drawImage(base, 0, 0, w, h)
  const img = dst.getImageData(0, 0, w, h)
  const radius = Math.max(2, Math.round(blurRadiusFor(base.width) * (w / base.width)))
  blurImageDataRGBA(img.data, w, h, radius)
  dst.putImageData(img, 0, 0)
  return out
}

function paint(
  canvas: HTMLCanvasElement,
  base: HTMLCanvasElement,
  blurred: HTMLCanvasElement | null,
  text: string,
  valign: VAlign,
  halign: HAlign,
  fontSize: FontSize,
  blurs: BlurRect[],
  dragRect: BlurRect | null,
) {
  canvas.width = base.width
  canvas.height = base.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(base, 0, 0)

  // ぼかしはテキストより先に描く（乗せた文字までぼけないように）。
  // 範囲ごとに「ぼかし版」から同じ座標を写す。転送元と転送先を同じ座標にすることで位置ズレしない。
  const all = dragRect ? [...blurs, dragRect] : blurs
  if (blurred) {
    // ぼかし版は縮小して作ってあるので、転送元だけ縮尺を掛ける。
    // 縦横の縮小率は丸めの都合で一致しないため必ず別々に計算する（横だけだと下端に未処理の帯が残る）。
    const sx = blurred.width / base.width
    const sy = blurred.height / base.height
    ctx.imageSmoothingEnabled = true
    for (const b of all) {
      if (b.w < 2 || b.h < 2) continue
      ctx.drawImage(blurred, b.x * sx, b.y * sy, b.w * sx, b.h * sy, b.x, b.y, b.w, b.h)
    }
  }

  // ドラッグ中の範囲は枠線を出して「どこを選んでいるか」を見せる
  if (dragRect && dragRect.w >= 2 && dragRect.h >= 2) {
    ctx.save()
    ctx.setLineDash([Math.max(4, canvas.width * 0.008), Math.max(4, canvas.width * 0.008)])
    ctx.lineWidth = Math.max(2, canvas.width * 0.004)
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
    ctx.restore()
  }

  const lines = text.split('\n').slice(0, 2).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return

  const px = Math.round(canvas.width * SIZE_RATIO[fontSize])
  ctx.font = `bold ${px}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.textAlign = halign
  ctx.lineWidth = Math.max(2, px * 0.12)

  const lineHeight = px * 1.35
  const totalHeight = lineHeight * lines.length
  const margin = canvas.width * 0.05
  const startY =
    valign === 'top' ? margin + lineHeight / 2
    : valign === 'bottom' ? canvas.height - margin - totalHeight + lineHeight / 2
    : (canvas.height - totalHeight) / 2 + lineHeight / 2
  const x = halign === 'left' ? margin : halign === 'right' ? canvas.width - margin : canvas.width / 2

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(line, x, y)
    ctx.fillStyle = '#fff'
    ctx.fillText(line, x, y)
  })
}

// EXIFを持たないcanvas再生成で書き出すため、既存の stripExif ステップとも安全に共存する
function toFile(canvas: HTMLCanvasElement, originalFile: File): Promise<File | null> {
  const outputType = originalFile.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return }
      const baseName = originalFile.name.replace(/\.[^.]+$/, '')
      const ext = outputType === 'image/jpeg' ? 'jpg' : 'png'
      resolve(new File([blob], `${baseName}_edit.${ext}`, { type: outputType, lastModified: Date.now() }))
    }, outputType, 0.92)
  })
}

export default function ThumbnailTextEditor({
  sourceFile,
  applied,
  onApply,
  onClear,
}: {
  sourceFile: File
  applied: boolean
  onApply: (file: File) => void
  onClear: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const blurredRef = useRef<HTMLCanvasElement | null>(null)
  // ドラッグ開始点。state に持つと移動のたびに起点が上書きされて範囲が壊れるため ref で固定する。
  const anchorRef = useRef<{ x: number; y: number } | null>(null)
  // 現在なぞっている範囲。state(drag) は画面の再描画用で、確定(pointerup)に使うと
  // 「最後の移動の再描画が終わる前に指が離れる」と1つ前の小さい範囲が確定されてしまう。
  // 実際に Safari(iPhone) で、なぞった範囲より狭い所だけがぼける不具合として出た。
  // 確定にはこの ref（移動のたびに同期的に更新される）を使う。
  const dragRef = useRef<BlurRect | null>(null)
  const [open, setOpen] = useState(false)
  const [baseReady, setBaseReady] = useState(false)
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [valign, setValign] = useState<VAlign>('bottom')
  const [halign, setHalign] = useState<HAlign>('center')
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [blurs, setBlurs] = useState<BlurRect[]>([])
  const [drag, setDrag] = useState<BlurRect | null>(null)

  // sourceFile は常に「加工前の元画像」。編集をやり直しても重ね書きされない。
  useEffect(() => {
    let cancelled = false
    setBaseReady(false)
    const url = URL.createObjectURL(sourceFile)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const { w, h } = workSize(img.naturalWidth, img.naturalHeight, WORK_MAX_PX)
      const base = document.createElement('canvas')
      base.width = w
      base.height = h
      base.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, w, h)
      baseRef.current = base
      blurredRef.current = makeBlurredCopy(base)
      setBaseReady(true)
    }
    img.src = url
    return () => { cancelled = true; URL.revokeObjectURL(url) }
  }, [sourceFile])

  useEffect(() => {
    if (!open || !baseReady || !baseRef.current || !canvasRef.current) return
    paint(canvasRef.current, baseRef.current, blurredRef.current, text, valign, halign, fontSize, blurs, drag)
  }, [open, baseReady, text, valign, halign, fontSize, blurs, drag])

  // 表示上の座標 → 作業用画像の実ピクセル座標。
  // canvas は object-fit を使わず縦横比そのままで表示しているため、単純な比率換算で一致する。
  const toImageCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    return toImageCoordsPure(canvas.getBoundingClientRect(), canvas.width, canvas.height, clientX, clientY)
  }

  const startDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'blur' || !canvasRef.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toImageCoords(e.clientX, e.clientY)
    anchorRef.current = p
    dragRef.current = { x: p.x, y: p.y, w: 0, h: 0 }
    setDrag(dragRef.current)
  }
  const moveDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const a = anchorRef.current
    if (!a || mode !== 'blur') return
    e.preventDefault()
    const r = rectFrom(a, toImageCoords(e.clientX, e.clientY))
    dragRef.current = r
    setDrag(r)
  }
  const endDrag = () => {
    if (!anchorRef.current) return
    anchorRef.current = null
    const r = dragRef.current
    dragRef.current = null
    if (r && r.w >= 4 && r.h >= 4) setBlurs(b => [...b, r])
    setDrag(null)
  }

  const apply = async () => {
    if (!baseRef.current || !canvasRef.current) return
    // 書き出し前にドラッグ中の枠線を除いて描き直す
    paint(canvasRef.current, baseRef.current, blurredRef.current, text, valign, halign, fontSize, blurs, null)
    const file = await toFile(canvasRef.current, sourceFile)
    if (file) { onApply(file); setOpen(false) }
  }

  const hasEdits = !!text.trim() || blurs.length > 0

  const gridBtn = (active: boolean) => ({
    width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
    border: active ? '2px solid var(--mm-primary)' : '1px solid var(--mm-border)',
    background: active ? 'var(--mm-primary-light)' : 'white',
  })
  const tabBtn = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const,
    border: active ? '2px solid var(--mm-primary)' : '1px solid var(--mm-border)',
    background: active ? 'var(--mm-primary-light)' : 'white',
    color: active ? 'var(--mm-primary)' : 'var(--mm-text-sub)',
  })

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--mm-text-sub)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Type size={13} /> {applied ? '加工を編集' : '文字入れ・ぼかし'}
        </button>
        {applied && (
          <button type="button" onClick={() => { setBlurs([]); setText(''); onClear() }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>
            <X size={12} /> 加工を削除
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, padding: 14, border: '1px solid var(--mm-border)', borderRadius: 10, background: 'var(--mm-bg)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setMode('text')} style={tabBtn(mode === 'text')}>
          <Type size={13} /> 文字入れ
        </button>
        <button type="button" onClick={() => setMode('blur')} style={tabBtn(mode === 'blur')}>
          <Droplet size={13} /> ぼかし
        </button>
      </div>

      {/* object-fit を使うと縦長写真で余白が入り、なぞった位置とぼける位置がズレる。
          幅だけ指定して高さは縦横比なりに伸ばし、表示とcanvas座標を1対1に保つ。 */}
      <canvas
        ref={canvasRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          width: '100%', maxWidth: 380, height: 'auto', borderRadius: 8, background: '#111',
          display: 'block', margin: '0 auto', touchAction: mode === 'blur' ? 'none' : 'auto',
          cursor: mode === 'blur' ? 'crosshair' : 'default',
        }}
      />

      {mode === 'blur' ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>
            隠したい部分を指やマウスでなぞってください（何度でも追加できます）
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setBlurs(b => b.slice(0, -1))} disabled={blurs.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--mm-border)', background: 'white', color: 'var(--mm-text-sub)', cursor: blurs.length ? 'pointer' : 'not-allowed', opacity: blurs.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              <Undo2 size={12} /> 1つ戻す
            </button>
            <button type="button" onClick={() => setBlurs([])} disabled={blurs.length === 0}
              style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--mm-border)', background: 'white', color: '#dc2626', cursor: blurs.length ? 'pointer' : 'not-allowed', opacity: blurs.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              全て消す
            </button>
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)', alignSelf: 'center' }}>{blurs.length}箇所</span>
          </div>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value.split('\n').slice(0, 2).join('\n'))}
            placeholder="サムネイルに乗せるテキスト（最大2行）"
            rows={2}
            style={{ width: '100%', marginTop: 10, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>位置</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 4 }}>
                {(['top', 'middle', 'bottom'] as VAlign[]).flatMap(v =>
                  (['left', 'center', 'right'] as HAlign[]).map(h => (
                    <button key={`${v}-${h}`} type="button" onClick={() => { setValign(v); setHalign(h) }}
                      style={gridBtn(v === valign && h === halign)} aria-label={`${v}-${h}`} />
                  ))
                )}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 4 }}>文字サイズ</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['small', 'medium', 'large'] as FontSize[]).map(s => (
                  <button key={s} type="button" onClick={() => setFontSize(s)}
                    style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', border: fontSize === s ? '2px solid var(--mm-primary)' : '1px solid var(--mm-border)', background: fontSize === s ? 'var(--mm-primary-light)' : 'white', color: fontSize === s ? 'var(--mm-primary)' : 'var(--mm-text-sub)' }}>
                    {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={() => setOpen(false)}
          style={{ flex: 1, padding: '8px', border: '1px solid var(--mm-border)', borderRadius: 8, background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--mm-text-sub)', whiteSpace: 'nowrap' }}>
          キャンセル
        </button>
        <button type="button" onClick={apply} disabled={!hasEdits}
          style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, background: 'var(--mm-primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: hasEdits ? 'pointer' : 'not-allowed', opacity: hasEdits ? 1 : 0.5, whiteSpace: 'nowrap' }}>
          適用
        </button>
      </div>
    </div>
  )
}
