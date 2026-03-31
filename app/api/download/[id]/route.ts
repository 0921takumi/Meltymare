import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 購入レコードを検証（自分の購入かつ納品済み）
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, user_id, delivery_status, delivered_file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('delivery_status', 'delivered')
    .single()

  if (!purchase || !purchase.delivered_file_url) {
    return NextResponse.json({ error: 'Not found or not yet delivered' }, { status: 404 })
  }

  const { data: urlData } = await supabase.storage
    .from('deliveries')
    .createSignedUrl(purchase.delivered_file_url, 300) // 5分有効

  if (!urlData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.redirect(urlData.signedUrl)
}
