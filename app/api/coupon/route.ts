import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/coupon?code=XXX&price=NNN  → クーポン検証 + 割引額返却
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase()
  const price = parseInt(req.nextUrl.searchParams.get('price') ?? '0')
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const supabase = await createClient()
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (!coupon) return NextResponse.json({ error: '有効なクーポンが見つかりません' }, { status: 404 })
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: 'クーポンの有効期限が切れています' }, { status: 400 })
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ error: 'このクーポンは使用上限に達しています' }, { status: 400 })
  }
  if (price < (coupon.min_amount ?? 0)) {
    return NextResponse.json({ error: `¥${coupon.min_amount?.toLocaleString()}以上のご購入から使用できます` }, { status: 400 })
  }

  const discount = coupon.discount_type === 'percent'
    ? Math.floor(price * coupon.discount_value / 100)
    : coupon.discount_value

  return NextResponse.json({
    id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discount_amount: Math.min(discount, price),
    final_price: Math.max(0, price - discount),
  })
}

// POST /api/coupon  → クリエイターがクーポン作成
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { code, discount_type, discount_value, min_amount, max_uses, expires_at } = body

  if (!code || !discount_type || !discount_value) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code: code.toUpperCase().trim(),
      discount_type,
      discount_value: parseInt(discount_value),
      min_amount: min_amount ? parseInt(min_amount) : 0,
      max_uses: max_uses ? parseInt(max_uses) : null,
      expires_at: expires_at || null,
      creator_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/coupon?id=XXX
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('coupons')
    .update({ is_active: false })
    .eq('id', id)
    .eq('creator_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
