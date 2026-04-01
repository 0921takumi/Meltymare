import { NextRequest, NextResponse } from 'next/server'
import { sendDeliveryEmail } from '@/app/api/webhook/route'

export async function POST(req: NextRequest) {
  try {
    const { purchase_id } = await req.json()
    if (!purchase_id) return NextResponse.json({ error: 'purchase_id required' }, { status: 400 })
    await sendDeliveryEmail(purchase_id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ ok: true }) // エラーでも200返す（メールは補助機能）
  }
}
