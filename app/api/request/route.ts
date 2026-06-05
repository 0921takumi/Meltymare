import { NextResponse } from 'next/server'

// 旧「カスタムリクエスト」(ファンが自由テキストでクリエイターに送信する機能) は廃止。
// 不適切なメッセージ送信を防ぐため、クリエイター主導のアンケート機能
// (/api/poll, /api/poll-vote) へ置き換えた。
export async function POST() {
  return NextResponse.json(
    { error: 'この機能は終了しました。アンケート機能をご利用ください。' },
    { status: 410 },
  )
}

export async function PATCH() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}
