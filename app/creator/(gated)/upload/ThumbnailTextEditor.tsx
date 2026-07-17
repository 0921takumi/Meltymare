'use client'

import { useEffect, useRef, useState } from 'react'
import { Type, X } from 'lucide-react'

type VAlign = 'top' | 'middle' | 'bottom'
type HAlign = 'left' | 'center' | 'right'
type FontSize = 'small' | 'medium' | 'large'

const SIZE_RATIO: Record<FontSize, number> = { small: 0.045, medium: 0.07, large: 0.1 }

// canvasに画像+テキストを描画する共通ロジック（プレビューと最終書き出しの両方で使う）
function paint(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  text: string,
  valign: VAlign,
  halign: HAlign,
  fontSize: FontSize,
) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)

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
      resolve(new File([blob], `${baseName}_text.${ext}`, { type: outputType, lastModified: Date.now() }))
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
  const [open, setOpen] = useState(false)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [text, setText] = useState('')
  const [valign, setValign] = useState<VAlign>('bottom')
  const [halign, setHalign] = useState<HAlign>('center')
  const [fontSize, setFontSize] = useState<FontSize>('medium')

  // sourceFile は常に「テキストを乗せる前の元画像」。編集をやり直しても重ね書きされない。
  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(sourceFile)
    const img = new Image()
    img.onload = () => { if (!cancelled) setImgEl(img) }
    img.src = url
    return () => { cancelled = true; URL.revokeObjectURL(url) }
  }, [sourceFile])

  useEffect(() => {
    if (!open || !imgEl || !canvasRef.current) return
    paint(canvasRef.current, imgEl, text, valign, halign, fontSize)
  }, [open, imgEl, text, valign, halign, fontSize])

  const apply = async () => {
    if (!imgEl || !canvasRef.current) return
    const file = await toFile(canvasRef.current, sourceFile)
    if (file) { onApply(file); setOpen(false) }
  }

  const gridBtn = (active: boolean) => ({
    width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
    border: active ? '2px solid var(--mm-primary)' : '1px solid var(--mm-border)',
    background: active ? 'var(--mm-primary-light)' : 'white',
  })

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={() => setOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--mm-text-sub)', cursor: 'pointer' }}>
          <Type size={13} /> {applied ? 'テキストを編集' : 'テキストを追加'}
        </button>
        {applied && (
          <button type="button" onClick={onClear}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={12} /> 削除
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, padding: 14, border: '1px solid var(--mm-border)', borderRadius: 10, background: 'var(--mm-bg)' }}>
      <canvas ref={canvasRef} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8, background: '#111', display: 'block' }} />

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
                style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: fontSize === s ? '2px solid var(--mm-primary)' : '1px solid var(--mm-border)', background: fontSize === s ? 'var(--mm-primary-light)' : 'white', color: fontSize === s ? 'var(--mm-primary)' : 'var(--mm-text-sub)' }}>
                {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={() => setOpen(false)}
          style={{ flex: 1, padding: '8px', border: '1px solid var(--mm-border)', borderRadius: 8, background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--mm-text-sub)' }}>
          キャンセル
        </button>
        <button type="button" onClick={apply} disabled={!text.trim()}
          style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, background: 'var(--mm-primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.5 }}>
          適用
        </button>
      </div>
    </div>
  )
}
