import { NextResponse } from 'next/server'

// ストーリーズ機能は廃止。FEATURES.stories=false で UI ルートはトップへリダイレクト、
// API は直叩きでも 410 Gone を返す（/api/auction と同パターン）。
export async function POST() {
  return NextResponse.json({ error: 'この機能は終了しました。' }, { status: 410 })
}
