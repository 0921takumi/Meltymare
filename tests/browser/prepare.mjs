/**
 * ブラウザテストの下準備。
 *   1) lib/thumbnail-edit.ts をブラウザに読ませる素の JS に変換する
 *   2) ぼかしの効き目を機械判定するための「縞模様」テスト画像を作る
 * 生成物は tests/browser/.build/ に置く（git 管理外）。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const BUILD = HERE + '.build'
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
mkdirSync(BUILD, { recursive: true })

// 1) TypeScript → 素の JS（ページに <script> で流し込むので export は落とす）
// 単体ファイルを直接指定すると tsconfig を読まないため、node_modules の型定義で
// 無関係なエラーが出て終了コードが 2 になる。変換結果さえ出ていればよいので握りつぶす。
try {
  // --module commonjs を明示する。省略すると ES モジュール（export 文つき）で出力され、
  // ページに <script> として流し込んだ瞬間に構文エラーになり、関数が1つも定義されない。
  execFileSync('npx', ['tsc', 'lib/thumbnail-edit.ts', '--target', 'es2020', '--module', 'commonjs', '--skipLibCheck', '--types', '', '--outDir', BUILD + '/_tsc'], {
    cwd: ROOT, shell: true, stdio: 'pipe',
  })
} catch { /* 型エラーは無視（純粋な変換目的） */ }
const js = readFileSync(BUILD + '/_tsc/thumbnail-edit.js', 'utf8')
  .split('\n')
  .filter(l => !/^"use strict";$|^Object\.defineProperty\(exports|^exports\./.test(l))
  .join('\n')
for (const fn of ['workSize', 'blurRadiusFor', 'boxBlurRGBA', 'blurImageDataRGBA', 'rectFrom', 'toImageCoords']) {
  if (!new RegExp(`function ${fn}\\b`).test(js)) throw new Error(`変換結果に ${fn} が入っていません`)
}
if (/^\s*export\s/m.test(js)) throw new Error('export 文が残っています（ページに読ませると構文エラーになります）')
writeFileSync(BUILD + '/thumbnail-edit.js', js)

// 2) 縞模様の JPEG（ぼかせばコントラストが落ちるので機械判定しやすい）
const sharp = (await import('sharp')).default
const W = 1200, H = 900
const raw = Buffer.alloc(W * H * 3)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const v = Math.floor(x / 12) % 2 === 0 ? 0 : 255
  const i = (y * W + x) * 3
  raw[i] = v; raw[i + 1] = v; raw[i + 2] = v
}
const buf = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 95 }).toBuffer()
writeFileSync(BUILD + '/fixture-stripes.jpg', buf)

console.log(`prepared: ${BUILD}`)
console.log(`  thumbnail-edit.js (${js.length}B) / fixture-stripes.jpg (${W}x${H}, ${buf.length}B)`)
