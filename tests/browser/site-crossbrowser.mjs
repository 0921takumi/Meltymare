/**
 * My Focus クロスブラウザ検証
 *   webkit  = Safari(iPhone/iPad/Mac) と同じエンジン
 *   chromium= Chrome / Edge / Android Chrome
 *   firefox = Firefox
 *
 * 検証対象:
 *   A. canvas の ctx.filter が効くか（=元の不具合の原因。WebKitでは効かないはず）
 *   B. 置き換えたピクセル演算のぼかしが全エンジンで効くか
 *   C. canvas.toBlob(image/jpeg) で書き出せるか
 *   D. PointerEvent / setPointerCapture（なぞる操作）
 *   E. getContext('2d', {willReadFrequently})
 *   F. CSS aspect-ratio: auto 4/3（読み込み中の場所取り／読み込み後は自然比）
 *   G. 本番の商品ページ（iPhone幅）: サムネが切り取られない・横スクロールしない・購入ボタンがある
 *   H. 本番の主要ページ: 表示・横あふれ・コンソールエラー
 */
import { chromium, webkit, firefox } from 'playwright'
import { readFileSync } from 'node:fs'

const LIB = readFileSync(new URL('./.build/thumbnail-edit.js', import.meta.url), 'utf8')
const SITE = process.env.SITE ?? 'https://my-focus.jp'
const DETAIL = `${SITE}/contents/381eb113-3204-48f9-88c5-a50b4d730f6e`

const ENGINES = [['webkit', webkit], ['chromium', chromium], ['firefox', firefox]]
const IPHONE = { width: 390, height: 844 }

const results = []
const check = (engine, name, ok, detail = '') => {
  results.push({ engine, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${engine}] ${name}${detail ? '  -- ' + detail : ''}`)
}

// ─── ページ内で走らせる関数群 ───────────────────────────────

function probeCanvasFilter() {
  const c = document.createElement('canvas')
  c.width = 40; c.height = 40
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 40, 40)
  ctx.fillStyle = '#fff'; ctx.fillRect(20, 0, 20, 40)
  const src = document.createElement('canvas')
  src.width = 40; src.height = 40
  src.getContext('2d').drawImage(c, 0, 0)
  ctx.filter = 'blur(6px)'
  const filterAccepted = ctx.filter === 'blur(6px)'
  ctx.clearRect(0, 0, 40, 40)
  ctx.drawImage(src, 0, 0)
  const px = ctx.getImageData(19, 20, 1, 1).data[0]
  // 効いていれば境界(19px)は 0 でも 255 でもない中間値になる
  return { filterAccepted, edgeValue: px, actuallyBlurred: px > 8 && px < 247 }
}

function runOurBlur() {
  const W = 200, H = 120
  const base = document.createElement('canvas')
  base.width = W; base.height = H
  const bctx = base.getContext('2d', { willReadFrequently: true })
  bctx.fillStyle = '#000'; bctx.fillRect(0, 0, W, H)
  bctx.fillStyle = '#fff'
  for (let x = 0; x < W; x += 10) bctx.fillRect(x, 0, 5, H) // 細かい縞（ぼかせば消える）

  // makeBlurredCopy 相当（1/4 に縮めてぼかす）
  const { w, h } = workSize(W, H, 60)
  const blurred = document.createElement('canvas')
  blurred.width = w; blurred.height = h
  const dst = blurred.getContext('2d', { willReadFrequently: true })
  dst.drawImage(base, 0, 0, w, h)
  const img = dst.getImageData(0, 0, w, h)
  const radius = Math.max(2, Math.round(blurRadiusFor(W) * (w / W)))
  blurImageDataRGBA(img.data, w, h, radius)
  dst.putImageData(img, 0, 0)

  // paint 相当（選択範囲だけ写す）
  const out = document.createElement('canvas')
  out.width = W; out.height = H
  const octx = out.getContext('2d', { willReadFrequently: true })
  octx.drawImage(base, 0, 0)
  const sx = blurred.width / W, sy = blurred.height / H
  const rect = { x: 20, y: 20, w: 100, h: 60 }
  octx.drawImage(blurred, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, rect.x, rect.y, rect.w, rect.h)

  // 縞のコントラスト（標準偏差）で判定する
  const stdev = (ctx, x, y, w2, h2) => {
    const d = ctx.getImageData(x, y, w2, h2).data
    let sum = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { sum += d[i]; n++ }
    const m = sum / n
    let v = 0
    for (let i = 0; i < d.length; i += 4) v += (d[i] - m) ** 2
    return Math.sqrt(v / n)
  }
  return {
    insideBefore: Math.round(stdev(bctx, 30, 30, 80, 40)),
    insideAfter: Math.round(stdev(octx, 30, 30, 80, 40)),
    outsideBefore: Math.round(stdev(bctx, 130, 90, 60, 20)),
    outsideAfter: Math.round(stdev(octx, 130, 90, 60, 20)),
    bottomEdgeAfter: Math.round(stdev(octx, 30, 74, 80, 5)), // 範囲の下端に未処理の帯が残らないか
  }
}

async function probeToBlob() {
  const c = document.createElement('canvas')
  c.width = 20; c.height = 20
  c.getContext('2d').fillRect(0, 0, 20, 20)
  const jpeg = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))
  const png = await new Promise(r => c.toBlob(r, 'image/png'))
  return { jpeg: jpeg ? { type: jpeg.type, size: jpeg.size } : null, png: png ? { type: png.type, size: png.size } : null }
}

function probeApis() {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d', { willReadFrequently: true })
  return {
    pointerEvent: typeof window.PointerEvent === 'function',
    setPointerCapture: typeof Element.prototype.setPointerCapture === 'function',
    willReadFrequentlyCtx: !!ctx,
    createObjectURL: typeof URL.createObjectURL === 'function',
    fileCtor: (() => { try { return new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }).size === 1 } catch { return false } })(),
    uint8Clamped: typeof Uint8ClampedArray === 'function',
  }
}

function probeAspectRatio() {
  const box = document.createElement('div')
  box.style.cssText = 'width:300px;overflow:hidden'
  const loading = document.createElement('img')
  loading.style.cssText = 'display:block;width:100%;height:auto;object-fit:contain;aspect-ratio:auto 4/3'
  loading.src = 'https://10.255.255.1/never.jpg' // 応答しない＝読み込み中のまま
  box.appendChild(loading)
  document.body.appendChild(box)
  const parsed = getComputedStyle(loading).aspectRatio
  const loadingHeight = Math.round(loading.getBoundingClientRect().height)
  return { computed: parsed, loadingHeight }
}

function probeAspectRatioLoaded(dataUrl) {
  return new Promise(resolve => {
    const box = document.createElement('div')
    box.style.cssText = 'width:300px;overflow:hidden'
    const im = document.createElement('img')
    im.style.cssText = 'display:block;width:100%;height:auto;object-fit:contain;aspect-ratio:auto 4/3'
    box.appendChild(im)
    document.body.appendChild(box)
    im.onload = () => setTimeout(() => resolve({
      height: Math.round(im.getBoundingClientRect().height),
      natural: [im.naturalWidth, im.naturalHeight],
    }), 50)
    im.onerror = () => resolve({ height: -1, natural: null })
    im.src = dataUrl
  })
}

function inspectDetailPage() {
  const img = document.querySelector('img.mm-content-detail-thumb-img')
  const doc = document.documentElement
  const overflow = doc.scrollWidth - doc.clientWidth
  if (!img) return { found: false, overflow }
  const r = img.getBoundingClientRect()
  const cs = getComputedStyle(img)
  const backdrop = img.parentElement?.querySelector('img[aria-hidden]')
  return {
    found: true,
    complete: img.complete,
    natural: [img.naturalWidth, img.naturalHeight],
    boxW: Math.round(r.width), boxH: Math.round(r.height),
    objectFit: cs.objectFit,
    aspectRatio: cs.aspectRatio,
    withinViewport: r.width <= doc.clientWidth + 1,
    backdropFilter: backdrop ? getComputedStyle(backdrop).filter : null,
    hasBuyButton: !!document.body.innerText.match(/購入|ログインして購入/),
    overflow,
  }
}

// ─── 実行 ────────────────────────────────────────────────

const WIDE_SVG = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="teal"/></svg>'
).toString('base64')

for (const [name, engineType] of ENGINES) {
  let browser
  try {
    browser = await engineType.launch()
    const ctx = await browser.newContext({ viewport: IPHONE, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    const consoleErrors = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message))

    await page.goto('about:blank')
    await page.addScriptTag({ content: LIB })

    // A. ctx.filter（元の不具合）
    const f = await page.evaluate(probeCanvasFilter)
    check(name, 'A. canvas ctx.filter が実際にぼかすか（参考: WebKitは効かない想定）',
      true, `filter受理=${f.filterAccepted} 実際にぼけた=${f.actuallyBlurred} 境界値=${f.edgeValue}`)

    // B. 置き換えたぼかし
    const b = await page.evaluate(runOurBlur)
    check(name, 'B. 置き換えたぼかしが範囲内を平滑化する',
      b.insideAfter < b.insideBefore * 0.35, `縞のコントラスト ${b.insideBefore} → ${b.insideAfter}`)
    check(name, 'B2. 範囲外は元のまま',
      Math.abs(b.outsideAfter - b.outsideBefore) <= 2, `${b.outsideBefore} → ${b.outsideAfter}`)
    check(name, 'B3. 範囲の下端に未処理の帯が残らない',
      b.bottomEdgeAfter < b.insideBefore * 0.5, `下端のコントラスト ${b.bottomEdgeAfter}（元 ${b.insideBefore}）`)

    // C. 書き出し
    const t = await page.evaluate(probeToBlob)
    check(name, 'C. canvas.toBlob で JPEG/PNG を書き出せる',
      t.jpeg?.type === 'image/jpeg' && t.png?.type === 'image/png' && t.jpeg.size > 0,
      `jpeg=${t.jpeg?.type}/${t.jpeg?.size}B png=${t.png?.type}/${t.png?.size}B`)

    // D/E. 操作に必要なAPI
    const a = await page.evaluate(probeApis)
    check(name, 'D/E. Pointer操作・File・willReadFrequently が使える',
      Object.values(a).every(Boolean), JSON.stringify(a))

    // F. CSS aspect-ratio
    const ar = await page.evaluate(probeAspectRatio)
    check(name, 'F1. 読み込み中に場所を確保する（幅300pxで225px前後）',
      ar.loadingHeight >= 200 && ar.loadingHeight <= 240, `computed=${ar.computed} height=${ar.loadingHeight}`)
    const arl = await page.evaluate(probeAspectRatioLoaded, WIDE_SVG)
    check(name, 'F2. 読み込み後は写真の自然比が勝つ（16:9なら169px前後）',
      arl.height >= 160 && arl.height <= 178, `height=${arl.height} natural=${JSON.stringify(arl.natural)}`)

    // G. 本番の商品ページ（iPhone幅）
    await page.goto(DETAIL, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(800)
    const d = await page.evaluate(inspectDetailPage)
    check(name, 'G1. 商品ページのサムネイルが存在し表示されている', d.found && d.boxH > 0, JSON.stringify({ boxW: d.boxW, boxH: d.boxH, natural: d.natural }))
    check(name, 'G2. サムネイルが切り取られない（object-fit: contain）', d.objectFit === 'contain', `objectFit=${d.objectFit}`)
    check(name, 'G3. 余白に敷くぼかし背景が効いている', !!d.backdropFilter && d.backdropFilter !== 'none', `filter=${d.backdropFilter}`)
    check(name, 'G4. 横スクロールが出ない', d.overflow <= 0, `scrollWidth-clientWidth=${d.overflow}`)
    check(name, 'G5. 購入導線が出ている', !!d.hasBuyButton)

    // H. 主要ページ
    for (const path of ['/', '/contents', '/polls']) {
      await page.goto(SITE + path, { waitUntil: 'networkidle', timeout: 45000 })
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      check(name, `H. ${path} が横あふれしない`, o <= 0, `overflow=${o}px`)
    }
    const fatal = consoleErrors.filter(e => !/favicon|Failed to load resource|net::ERR|404|10\.255\.255\.1/i.test(e))
    check(name, 'H2. 致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 3).join(' | ') || 'なし')
  } catch (e) {
    const msg = String(e?.message ?? e)
    // Windows では Firefox の実行がセキュリティ設定で弾かれることがある（spawn UNKNOWN）。
    // サイト側の問題ではないので、起動できないエンジンは「未実施」として扱う。
    if (/browserType\.launch/.test(msg)) {
      console.log(`SKIP [${name}] このエンジンは起動できませんでした（${msg.split('\n')[0].slice(0, 80)}）`)
    } else {
      check(name, 'エンジン実行', false, msg.slice(0, 300))
    }
  } finally {
    await browser?.close()
  }
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) { console.log('FAILED:'); for (const f of failed) console.log(`  [${f.engine}] ${f.name} -- ${f.detail}`) }
process.exit(failed.length ? 1 : 0)
