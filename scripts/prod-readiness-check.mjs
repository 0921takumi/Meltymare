/**
 * 本番レディネスチェック（再発防止の常設ツール）
 *
 * 目的:
 *   「コードは正しいのに本番のDB/RLS/ストレージ/環境変数の設定がズレていて、
 *    実ユーザーが触った瞬間に壊れる」種類のバグを、ユーザーより先に踏み抜く。
 *
 * 何をするか:
 *   テスト用のクリエイター＆ファンを本番に作り、主要フローを実際に叩いて
 *   pass/fail を一覧表示する。テストデータは毎回自動で後始末する。
 *
 * 使い方:
 *   cd myfocus && node scripts/prod-readiness-check.mjs
 *   各フェーズ移行前 / 大きめのデプロイ後 に流す。
 *   1つでも 🔴 が出たら、それが「実ユーザーが踏む地雷」。
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => { const l = env.split('\n').find((x) => x.startsWith(k + '=')); return l ? l.split('=').slice(1).join('=').trim() : null }
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anonKey = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const svc = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SECRET_KEY') || get('SUPABASE_SERVICE_KEY')
const admin = createClient(url, svc, { auth: { persistSession: false } })
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const stamp = Date.now()
const results = []
const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

// ── バケット公開フラグ（表示用は public、機微は private が正）──
const { data: buckets } = await admin.storage.listBuckets()
const bmap = Object.fromEntries((buckets || []).map((b) => [b.name, b.public]))
ok('bucket avatars=public', bmap.avatars === true, `public=${bmap.avatars}`)
ok('bucket thumbnails=public', bmap.thumbnails === true, `public=${bmap.thumbnails}`)
ok('bucket contents=private', bmap.contents === false, `public=${bmap.contents}`)
ok('bucket deliveries=private', bmap.deliveries === false, `public=${bmap.deliveries}`)
ok('bucket identity_documents=private', bmap.identity_documents === false, `public=${bmap.identity_documents}`)

// ── RPC 存在 ──
const probeRpc = async (name, args) => {
  const { error } = await admin.rpc(name, args)
  return !error || !/could not find the function|does not exist|schema cache/i.test(error.message)
}
const DUMMY = '00000000-0000-0000-0000-000000000000'
ok('rpc redeem_invite_code', await probeRpc('redeem_invite_code', { p_invite_code_id: DUMMY }))
ok('rpc increment_coupon_used', await probeRpc('increment_coupon_used', { coupon_id: DUMMY }))
ok('rpc increment_sold_count', await probeRpc('increment_sold_count', { content_id: DUMMY }))

// ── handle_new_user トリガー（新規登録でprofile自動生成）──
{
  const email = `rc-trig-${stamp}@my-focus.jp`
  const { data: c } = await admin.auth.admin.createUser({ email, password: `Rc-${stamp}-Aa1!`, email_confirm: true, user_metadata: { display_name: 'rc' } })
  const { data: prof } = await admin.from('profiles').select('id').eq('id', c.user.id).maybeSingle()
  ok('signup→profile自動生成(trigger)', !!prof)
  await admin.auth.admin.deleteUser(c.user.id)
}

// ── テストクリエイター & ファン ──
const mk = async (label, role) => {
  const email = `rc-${label}-${stamp}@my-focus.jp`
  const pw = `Rc-${stamp}-Aa1!`
  const { data } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { display_name: label } })
  if (role) await admin.from('profiles').update({ role }).eq('id', data.user.id)
  const cli = createClient(url, anonKey, { auth: { persistSession: false } })
  await cli.auth.signInWithPassword({ email, password: pw })
  return { id: data.user.id, cli }
}
const creator = await mk('creator', 'creator')
const fan = await mk('fan', null)

// ── クリエイター: 署名URL方式で出品アップロード ──
for (const bucket of ['contents', 'thumbnails']) {
  const path = `${creator.id}/${stamp}.png`
  const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  const up = signed ? await creator.cli.storage.from(bucket).uploadToSignedUrl(path, signed.token, PNG, { contentType: 'image/png' }) : { error: sErr }
  ok(`creator upload ${bucket} (署名URL)`, !up.error, up.error?.message ?? '')
  if (!up.error) await admin.storage.from(bucket).remove([path])
}
// コンテンツ行 insert
{
  const ins = await creator.cli.from('contents').insert({ creator_id: creator.id, title: 'RC', price: 100, content_type: 'image', file_url: 'x', thumbnail_url: 'x', is_published: false }).select('id').maybeSingle()
  ok('creator insert contents row', !ins.error, ins.error?.message ?? '')
  if (ins.data?.id) await admin.from('contents').delete().eq('id', ins.data.id)
}
// アバターアップロード（service_role経由を模擬: avatars直upload）
{
  const p = `${creator.id}.png`
  const up = await admin.storage.from('avatars').upload(p, PNG, { upsert: true, contentType: 'image/png' })
  const { data: pub } = admin.storage.from('avatars').getPublicUrl(p)
  let disp = 0; try { disp = (await fetch(pub.publicUrl)).status } catch {}
  ok('avatar upload+display', !up.error && disp === 200)
  await admin.storage.from('avatars').remove([p])
}
// 本人確認（書類UP + 本人PII更新）
{
  const p = `${creator.id}/kyc_${stamp}.png`
  const u = await creator.cli.storage.from('identity_documents').upload(p, PNG, { contentType: 'image/png' })
  const upd = await creator.cli.from('profiles').update({ identity_status: 'pending', birthdate: '2000-01-01' }).eq('id', creator.id)
  ok('identity 書類UP+PII更新', !u.error && !upd.error, u.error?.message ?? upd.error?.message ?? '')
  if (!u.error) await admin.storage.from('identity_documents').remove([p])
}

// ── ファン: 閲覧 / フォロー / 購入閲覧 ──
const rp = await fan.cli.from('contents').select('id').eq('is_published', true).limit(1)
ok('fan 公開コンテンツ閲覧', !rp.error)
const fl = await fan.cli.from('follows').insert({ follower_id: fan.id, creator_id: creator.id })
ok('fan フォロー', !fl.error, fl.error?.message ?? '')
if (!fl.error) await admin.from('follows').delete().eq('follower_id', fan.id)
const pr = await fan.cli.from('purchases').select('id').eq('user_id', fan.id)
ok('fan 自分の購入閲覧', !pr.error)

// ── 本人プロフィール読み取り（ログイン状態判定の要）──
const selfProf = await fan.cli.from('profiles').select('id, display_name, role').eq('id', fan.id).maybeSingle()
ok('本人プロフィール読み取り(ログイン判定)', !!selfProf.data, selfProf.error?.message ?? '')

// 後始末
await admin.auth.admin.deleteUser(creator.id)
await admin.auth.admin.deleteUser(fan.id)

// ── 出力 ──
const fail = results.filter((r) => !r.pass)
console.log('\n=== MyFocus 本番レディネスチェック ===\n')
for (const r of results) console.log(`${r.pass ? '✅' : '🔴'} ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`)
console.log(`\n${fail.length === 0 ? '🎉 全フロー本番OK。実ユーザーが触っても壊れません。' : `⚠️ ${fail.length}件の地雷あり → 上の🔴を修正してください。`}\n`)
process.exit(fail.length === 0 ? 0 : 1)
