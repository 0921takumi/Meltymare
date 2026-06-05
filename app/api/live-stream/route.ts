import { NextResponse } from 'next/server'

// ライブ配信機能は廃止。FEATURES.live=false で UI ルートはトップへリダイレクト、
// API は直叩きでも 410 Gone を返す（/api/auction と同パターン）。
export async function POST() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}

export async function PATCH() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}
