import { NextResponse } from 'next/server'

// リクエストオークションは廃止。アンケート機能へ置き換えた。
export async function POST() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}
