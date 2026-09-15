/**
 * 管理コンソール「ユーザー管理」の操作メニュー（…）の実機エンジン E2E。
 *
 * 2026-09 に「クリエイターに昇格を押しても反応しない」と報告された。原因は API が
 * 「本人確認が未承認」で拒否しているのに画面が何も表示していなかったこと。
 * ここでは本番の画面を実際に操作し、次を確かめる:
 *   1. 本人確認が未承認のユーザーには、押せるボタンの代わりに理由が表示される
 *   2. API が失敗したら、その理由が画面に出る（通信を差し替えて失敗を再現）
 *   3. 承認済みユーザーを昇格できる／クリエイターを一般ユーザーに戻せる（DBで確認）
 *   4. スマホ幅でも、表の一番下の行のメニューが枠で切れずに押せる
 *
 * 本番の実アカウントには触らない。使い捨ての管理者1名＋対象3名を作り、最後に必ず全部消す
 * （監査ログ → プロフィール → 認証ユーザー の順。監査ログが残るとプロフィールを消せない）。
 */
import { chromium, webkit } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SITE = process.env.SITE ?? 'https://my-focus.jp'
const ENVFILE = fileURLToPath(new URL('../../.env.local', import.meta.url))
const env = Object.fromEntries(readFileSync(ENVFILE, 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const results = []
const check = (scope, name, ok, detail = '') => {
  results.push({ scope, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${scope}] ${name}${detail ? '  -- ' + detail : ''}`)
}

const tag = randomBytes(3).toString('hex')
const made = []
async function mkUser(label, patch) {
  const email = `e2e-ua-${label}-${tag}@example.invalid`
  const password = randomBytes(15).toString('base64url') + 'Aa1!'
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: `e2e-ua-${label}-${tag}`, signup_invite_code: 'MYF-E2ETST' },
  })
  if (error) throw new Error(`${label}: ${error.message}`)
  made.push(data.user.id)
  const { error: pErr } = await db.from('profiles').update({ display_name: `e2e-ua-${label}-${tag}`, ...patch }).eq('id', data.user.id)
  if (pErr) throw new Error(`${label} profile: ${pErr.message}`)
  return { id: data.user.id, email, password, name: `e2e-ua-${label}-${tag}` }
}
const roleOf = async id => (await db.from('profiles').select('role').eq('id', id).single()).data?.role

async function cleanup() {
  const errors = []
  if (made.length) {
    const r = await db.from('admin_actions').delete().or(`admin_id.in.(${made.join(',')}),target_id.in.(${made.join(',')})`)
    if (r.error) errors.push('admin_actions: ' + r.error.message)
  }
  for (const id of made) {
    const p = await db.from('profiles').delete().eq('id', id)
    if (p.error) errors.push(`profile ${id.slice(0, 8)}: ${p.error.message}`)
    const a = await db.auth.admin.deleteUser(id)
    if (a.error && !/not found/i.test(a.error.message)) errors.push(`auth ${id.slice(0, 8)}: ${a.error.message}`)
  }
  // 残骸が無いことを確かめる（消したつもりで消えていなかった前例がある）
  const { data: left } = await db.from('profiles').select('id').like('email', `e2e-ua-%-${tag}@example.invalid`)
  if (left?.length) errors.push(`残ったプロフィール ${left.length}件`)
  return errors
}

try {
  const adminUser = await mkUser('admin', { role: 'admin' })
  const userNoId = await mkUser('usernoid', { role: 'user', identity_status: 'unsubmitted' })
  const userOk = await mkUser('userok', { role: 'user', identity_status: 'approved' })
  const creator = await mkUser('creator', { role: 'creator', identity_status: 'approved' })

  for (const [engineName, engine] of [['webkit(Safari)', webkit], ['chromium(Chrome/Edge)', chromium]]) {
    for (const [vpName, viewport] of [['PC', { width: 1280, height: 900 }], ['iPhone SE', { width: 375, height: 667 }]]) {
      const scope = `${engineName} / ${vpName}`
      // 状態を毎回そろえる（前の周回で昇格・降格しているため）
      await db.from('profiles').update({ role: 'user' }).eq('id', userOk.id)
      await db.from('profiles').update({ role: 'creator' }).eq('id', creator.id)

      const browser = await engine.launch()
      const ctx = await browser.newContext({ viewport, locale: 'ja-JP' })
      const page = await ctx.newPage()
      page.on('dialog', d => d.accept())
      try {
        await page.goto(`${SITE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.fill('input[type="email"]', adminUser.email)
        await page.fill('input[type="password"]', adminUser.password)
        await page.click('button[type="submit"]')
        await page.waitForURL(u => !u.pathname.startsWith('/auth/login'), { timeout: 60000 })

        const openMenuFor = async (name) => {
          await page.goto(`${SITE}/admin/users?role=all&q=${encodeURIComponent(`e2e-ua-`)}`, { waitUntil: 'networkidle', timeout: 60000 })
          const row = page.locator('tr').filter({ hasText: name }).first()
          await row.getByRole('button', { name: '操作メニュー' }).click()
          return row
        }

        // 1) 本人確認が未承認: 押せるボタンは無く、理由が見える
        {
          const row = await openMenuFor(userNoId.name)
          const promoteBtn = await row.getByRole('menuitem', { name: 'クリエイターに昇格' }).count()
          const reason = row.getByText('クリエイターに昇格できません')
          const visible = await reason.isVisible().catch(() => false)
          check(scope, '1. 本人確認が未承認なら、昇格ボタンの代わりに理由を表示', promoteBtn === 0 && visible, `昇格ボタン=${promoteBtn} 理由表示=${visible}`)
          const statusCell = await row.getByText('未提出').count()
          check(scope, '1b. 一覧に本人確認「未提出」が見える', statusCell > 0)
        }

        // 2) API が失敗したら理由が出る（通信を差し替えて失敗を再現する）
        {
          await page.route('**/api/admin-user', r => r.fulfill({
            status: 403, contentType: 'application/json',
            body: JSON.stringify({ error: 'identity_not_approved', detail: '本人確認が承認されていないユーザーはクリエイターにできません' }),
          }))
          const row = await openMenuFor(userOk.name)
          await row.getByRole('menuitem', { name: 'クリエイターに昇格' }).click()
          const alert = row.getByRole('alert')
          await alert.waitFor({ timeout: 10000 }).catch(() => {})
          const text = (await alert.innerText().catch(() => '')).trim()
          check(scope, '2. API が失敗したら理由が画面に出る（無反応にならない）', text.includes('本人確認'), text.slice(0, 60))
          check(scope, '2b. 失敗時はロールが変わらない', (await roleOf(userOk.id)) === 'user')
          await page.unroute('**/api/admin-user')
        }

        // 3) 承認済みユーザーの昇格 / クリエイターを戻す
        {
          const row = await openMenuFor(userOk.name)
          const resp = page.waitForResponse(r => r.url().includes('/api/admin-user'), { timeout: 20000 })
          await row.getByRole('menuitem', { name: 'クリエイターに昇格' }).click()
          const status = (await resp).status()
          await page.waitForTimeout(800)
          check(scope, '3. 承認済みユーザーをクリエイターに昇格できる', status === 200 && (await roleOf(userOk.id)) === 'creator', `status=${status}`)
        }
        {
          const row = await openMenuFor(creator.name)
          const resp = page.waitForResponse(r => r.url().includes('/api/admin-user'), { timeout: 20000 })
          await row.getByRole('menuitem', { name: '一般ユーザーに戻す' }).click()
          const status = (await resp).status()
          await page.waitForTimeout(800)
          check(scope, '3b. クリエイターを一般ユーザーに戻せる', status === 200 && (await roleOf(creator.id)) === 'user', `status=${status}`)
        }

        // 4) 一番下の行でもメニューが枠で切れず押せる
        {
          await page.goto(`${SITE}/admin/users?role=all&q=${encodeURIComponent(`e2e-ua-`)}`, { waitUntil: 'networkidle', timeout: 60000 })
          const rows = page.locator('tbody tr')
          const last = rows.last()
          await last.getByRole('button', { name: '操作メニュー' }).click()
          const firstItem = last.getByRole('menuitem').first()
          await firstItem.scrollIntoViewIfNeeded()
          // 実際にその位置で一番上に描かれている要素がメニュー項目か（枠に切られて別要素が当たらないか）
          const hit = await firstItem.evaluate(el => {
            const r = el.getBoundingClientRect()
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            return { inside: !!top && (top === el || el.contains(top)), h: Math.round(r.height) }
          })
          check(scope, '4. 一番下の行のメニューも切れずに押せる', hit.inside && hit.h > 20, JSON.stringify(hit))
        }
      } catch (e) {
        check(scope, 'シナリオ実行', false, String(e?.message ?? e).split('\n')[0].slice(0, 200))
      } finally {
        await browser.close()
      }
    }
  }
} catch (e) {
  check('setup', '準備', false, String(e?.message ?? e).slice(0, 200))
} finally {
  const errs = await cleanup()
  check('cleanup', '検証用アカウントと監査ログを全て削除', errs.length === 0, errs.join(' / ') || `${made.length}名削除`)
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) { console.log('FAILED:'); for (const f of failed) console.log(`  [${f.scope}] ${f.name} -- ${f.detail}`) }
process.exit(failed.length ? 1 : 0)
