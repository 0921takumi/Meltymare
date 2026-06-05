import { NextResponse } from 'next/server'

// リクエストオークションは廃止。入札も停止。
export async function POST() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}
