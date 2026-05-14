/**
 * EXIFメタデータ除去ユーティリティ（ブラウザ側）。
 *
 * 目的:
 *   - クリエイターが投稿する写真には GPS 座標・カメラ機種・タイムスタンプ等の EXIF が含まれる
 *     ことがあり、自宅や撮影場所が特定されるリスクがある
 *   - Canvas API で再エンコードすることで、EXIF を含む全メタデータを破棄する
 *   - 画像の見た目（pixel data）は保持される
 *
 * 制限:
 *   - HEIC は多くのブラウザがネイティブデコードできないため、HEIC は呼び出し側で
 *     事前に reject するか、サーバ側で変換すること
 *   - SVG はバイナリ画像でないので再エンコード不可。SVG は本サービスでは UGC として受け取らない前提
 *   - 透過 PNG は PNG として再エンコード（JPEG にすると黒背景になるため）
 *
 * 使い方:
 *   const safe = await stripExif(file)   // 失敗時は元 file を返す（fail-safe）
 *   await supabase.storage.from('contents').upload(path, safe, { contentType: safe.type })
 */

const MAX_DIMENSION = 4096  // 異常に大きい画像は縮小（メモリ保護）

/**
 * File から EXIF を含む全メタデータを除去した新しい File を返す。
 *
 * @param file - 元のファイル
 * @param options - 再エンコード時の品質（JPEG のみ有効、0-1）
 */
export async function stripExif(
  file: File,
  options: { jpegQuality?: number } = {},
): Promise<File> {
  // 画像でないものはそのまま返す（動画など）
  if (!file.type.startsWith('image/')) return file

  // SVG は再エンコードしない（バイナリ画像ではないため）
  if (file.type === 'image/svg+xml') return file

  // HEIC はブラウザでデコードできないので、呼び出し側で別途処理してもらう
  if (file.type === 'image/heic' || file.type === 'image/heif') return file

  try {
    const img = await loadImage(file)

    // 異常に大きい画像はリサイズ（OOM対策）
    let { width, height } = img
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, width, height)

    // 透過の有無で出力形式を切り替え
    // 元が PNG/WebP/GIF なら PNG で出力（透過保持）、JPEG なら JPEG で出力
    const outputType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const quality = options.jpegQuality ?? 0.92

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, outputType, quality),
    )
    if (!blob) return file

    // 拡張子を出力形式に合わせる
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const ext = outputType === 'image/jpeg' ? 'jpg' : 'png'
    return new File([blob], `${baseName}.${ext}`, {
      type: outputType,
      lastModified: Date.now(),
    })
  } catch (err) {
    console.warn('[strip-exif] failed, returning original:', err)
    return file
  }
}

/** File → HTMLImageElement のローダ */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = e => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
