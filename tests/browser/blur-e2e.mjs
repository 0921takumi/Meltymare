/**
 * サムネイル「ぼかし」の実機エンジン E2E。
 * 本番の出品画面を実際に操作し、なぞった範囲が本当にぼけるかを確かめる。
 *
 * 本番の実アカウントには触らない。検証専用の使い捨てクリエイターを作り、最後に必ず削除する。
 * 出品（保存）は一切行わない＝商品テーブルには何も残さない。
 *
 * 検証ブラウザ: webkit(=iPhone/iPad/Mac の Safari と同じエンジン), chromium(=Chrome/Edge/Android)
 * 端末幅: iPhone SE / iPhone 14 Pro Max / iPad / デスクトップ
 */
import { chromium, webkit } from 'playwright'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SITE = process.env.SITE ?? 'https://my-focus.jp'
const ENVFILE = fileURLToPath(new URL('../../.env.local', import.meta.url))
const env = Object.fromEntries(
  readFileSync(ENVFILE, 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EMAIL = `e2e-blur-${randomBytes(4).toString('hex')}@example.invalid`
const PASSWORD = randomBytes(15).toString('base64url') + 'Aa1!'
const FIXTURE = fileURLToPath(new URL('./.build/fixture-stripes.jpg', import.meta.url))
let tempUserId = null

const results = []
const check = (engine, name, ok, detail = '') => {
  results.push({ engine, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${engine}] ${name}${detail ? '  -- ' + detail : ''}`)
}

const VIEWPORTS = [
  ['iPhone SE', { width: 375, height: 667 }],
  ['iPhone 14 Pro Max', { width: 430, height: 932 }],
  ['iPad', { width: 768, height: 1024 }],
  ['デスクトップ', { width: 1280, height: 800 }],
]

// canvas を6x6の格子に分けて各マスのコントラストを測る（なぞった範囲が全部ぼけたか厳密に見る）
const GRID = () => {
  const c = document.querySelector(`canvas`)
  const ctx = c.getContext(`2d`, { willReadFrequently: true })
  const N = 6, rows = []
  for (let gy = 0; gy < N; gy++) {
    const row = []
    for (let gx = 0; gx < N; gx++) {
      const w = Math.floor(c.width / N), h = Math.floor(c.height / N)
      const d = ctx.getImageData(gx * w, gy * h, w, h).data
      let sum = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { sum += d[i]; n++ }
      const m = sum / n
      let v = 0
      for (let i = 0; i < d.length; i += 4) v += (d[i] - m) ** 2
      row.push(Math.round(Math.sqrt(v / n)))
    }
    rows.push(row)
  }
  return rows
}

// canvas 内の一部を切り出して明暗のばらつき（縞のコントラスト）を測る
const MEASURE = (ff) => {
  const c = document.querySelector('canvas')
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const x = Math.round(c.width * ff.x), y = Math.round(c.height * ff.y)
  const w = Math.round(c.width * ff.w), h = Math.round(c.height * ff.h)
  const d = ctx.getImageData(x, y, w, h).data
  let sum = 0, n = 0
  for (let i = 0; i < d.length; i += 4) { sum += d[i]; n++ }
  const m = sum / n
  let v = 0
  for (let i = 0; i < d.length; i += 4) v += (d[i] - m) ** 2
  return Math.round(Math.sqrt(v / n))
}

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL, password: PASSWORD, email_confirm: true,
  user_metadata: { display_name: 'e2e blur verify', signup_invite_code: 'MYF-E2ETST' },
})
if (createErr) { console.error('temp user creation failed:', createErr.message); process.exit(2) }
tempUserId = created.user.id
await admin.from('profiles').update({ role: 'creator' }).eq('id', tempUserId)
console.log('temp creator ready:', tempUserId)

try {
  for (const [engineName, engineType] of [['webkit(Safari/iPhone)', webkit], ['chromium(Chrome/Edge/Android)', chromium]]) {
    let browser
    try {
      browser = await engineType.launch()
      for (const [vpName, viewport] of VIEWPORTS) {
        const label = `${engineName} / ${vpName}`
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'ja-JP' })
        const page = await ctx.newPage()
        const errors = []
        page.on('pageerror', e => errors.push(e.message))
        try {
          // ── ログイン ──
          await page.goto(`${SITE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
          await page.fill('input[type="email"]', EMAIL)
          await page.fill('input[type="password"]', PASSWORD)
          await page.click('button[type="submit"]')
          await page.waitForURL(u => !u.pathname.startsWith('/auth/login'), { timeout: 60000 })

          // ── 出品画面 → サムネイル選択 ──
          await page.goto(`${SITE}/creator/upload`, { waitUntil: 'networkidle', timeout: 60000 })
          await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles(FIXTURE)
          const editorBtn = page.getByRole('button', { name: /文字入れ・ぼかし|加工を編集/ })
          await editorBtn.waitFor({ timeout: 20000 })
          check(label, '1. サムネイルを選ぶと加工ボタンが出る', true)

          // ── 加工エディタを開いて「ぼかし」タブへ ──
          await editorBtn.click()
          const canvas = page.locator('canvas')
          await canvas.waitFor({ timeout: 20000 })
          await page.waitForFunction(() => {
            const c = document.querySelector('canvas')
            return !!c && c.width > 10 && c.height > 10
          }, { timeout: 30000 })
          await page.getByRole('button', { name: 'ぼかし' }).click()

          const CENTER = { x: 0.35, y: 0.35, w: 0.3, h: 0.3 }
          const CORNER = { x: 0.02, y: 0.85, w: 0.15, h: 0.1 }
          const beforeIn = await page.evaluate(MEASURE, CENTER)
          const beforeOut = await page.evaluate(MEASURE, CORNER)

          // ── 実際になぞる ──
          const box = await canvas.boundingBox()
          const x1 = box.x + box.width * 0.3, y1 = box.y + box.height * 0.3
          const x2 = box.x + box.width * 0.7, y2 = box.y + box.height * 0.7
          await page.mouse.move(x1, y1)
          await page.mouse.down()
          await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 })
          await page.mouse.move(x2, y2, { steps: 6 })
          await page.mouse.up()
          await page.waitForTimeout(500)

          const afterIn = await page.evaluate(MEASURE, CENTER)
          const afterOut = await page.evaluate(MEASURE, CORNER)
          const grid = await page.evaluate(GRID)
          // なぞったのは 30%〜70%。1/6刻みの格子で完全に内側になるのは 2〜3 行/列。
          // ここが全部ぼけていなければ「なぞった範囲より狭い所だけぼけている」＝不具合。
          const inner = [2, 3].flatMap(y => [2, 3].map(x => grid[y][x]))
          const outer = [grid[0][0], grid[0][5], grid[5][0], grid[5][5]]
          check(label, '2. なぞった範囲が隅々までぼける',
            beforeIn > 40 && Math.max(...inner) < 15,
            '中央 ' + beforeIn + ' → ' + afterIn + ' / 内側4マス [' + inner.join(',') + ']')
          check(label, '3. なぞっていない範囲は変わらない',
            Math.abs(afterOut - beforeOut) <= 3 && Math.min(...outer) > 100,
            '隅 ' + beforeOut + ' → ' + afterOut + ' / 四隅 [' + outer.join(',') + ']')

          const count = await page.getByText(/\d+箇所/).innerText().catch(() => '')
          check(label, '4. ぼかし範囲が1件登録される', /1箇所/.test(count), count)

          // ── 適用（出品はしない）──
          await page.getByRole('button', { name: '適用' }).click()
          await page.waitForTimeout(800)
          const applied = await page.getByRole('button', { name: '加工を編集' }).count()
          const canRemove = await page.getByText('加工を削除').count()
          check(label, '5. 「適用」でサムネイルに反映される', applied > 0 && canRemove > 0, `編集ボタン=${applied} 削除リンク=${canRemove}`)
          // 画面遷移で中断された通信（WebKit は "Load failed" / "access control checks" と報告する）は
          // アプリの不具合ではないので除く。それ以外の JS 例外は落とす。
          const fatal = errors.filter(e => !/Load failed|access control checks|Fetch API cannot load|AbortError/i.test(e))
          check(label, '6. 操作中にJSエラーが出ない', fatal.length === 0,
            (fatal.slice(0, 2).join(' | ') || 'なし') + (errors.length !== fatal.length ? ` (通信中断 ${errors.length - fatal.length}件は除外)` : ''))
        } catch (e) {
          check(label, 'シナリオ実行', false, String(e?.message ?? e).split('\n')[0].slice(0, 200))
        } finally {
          await ctx.close()
        }
      }
    } catch (e) {
      check(engineName, 'エンジン起動', false, String(e?.message ?? e).slice(0, 200))
    } finally {
      await browser?.close()
    }
  }
} finally {
  // 後片付けは「消したつもり」にしない。エラーを見て、最後に残骸が無いことを確かめる
  // （別のテストで、参照が残っていてプロフィール削除が失敗し、検証用の管理者が本番に残った前例がある）。
  const errs = []
  const c = await admin.from('contents').delete().eq('creator_id', tempUserId)
  if (c.error) errs.push('contents: ' + c.error.message)
  const p = await admin.from('profiles').delete().eq('id', tempUserId)
  if (p.error) errs.push('profile: ' + p.error.message)
  const a = await admin.auth.admin.deleteUser(tempUserId)
  if (a.error && !/not found/i.test(a.error.message)) errs.push('auth: ' + a.error.message)
  const { data: left } = await admin.from('profiles').select('id').eq('id', tempUserId)
  if (left?.length) errs.push('プロフィールが残っています')
  check('cleanup', '検証用アカウントを削除', errs.length === 0, errs.join(' / ') || tempUserId.slice(0, 8))
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) { console.log('FAILED:'); for (const f of failed) console.log(`  [${f.engine}] ${f.name} -- ${f.detail}`) }
process.exit(failed.length ? 1 : 0)
