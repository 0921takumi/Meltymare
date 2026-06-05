// 読み取り専用：本番DBの全テーブル・カラムを取得（PostgREST OpenAPIスペック経由）
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
const spec = await res.json()
const defs = spec.definitions ?? {}
const tables = Object.keys(defs).sort()
console.log(`テーブル数: ${tables.length}\n`)
for (const t of tables) {
  const cols = Object.keys(defs[t].properties ?? {})
  console.log(`【${t}】`)
  console.log('  ' + cols.join(', '))
}
