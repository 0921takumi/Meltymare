import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { sanitizeText, sanitizeOptional, sanitizeUrl } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase } = ctx

  const body = await req.json()
  const title = sanitizeText(body.title, { maxLength: 200 })
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const subtitle = sanitizeOptional(body.subtitle, { maxLength: 400 })
  const creator_id = body.creator_id && UUID_RE.test(body.creator_id) ? body.creator_id : null
  const content_id = body.content_id && UUID_RE.test(body.content_id) ? body.content_id : null
  const link_url = sanitizeUrl(body.link_url)
  const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0

  const { data, error } = await supabase
    .from('featured_banners')
    .insert({ title, subtitle, creator_id, content_id, link_url, sort_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase } = ctx

  const body = await req.json()
  if (!body.id || !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  // 許可フィールドだけを通す
  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = sanitizeText(body.title, { maxLength: 200 })
  if (body.subtitle !== undefined) updates.subtitle = sanitizeOptional(body.subtitle, { maxLength: 400 })
  if (body.link_url !== undefined) updates.link_url = sanitizeUrl(body.link_url)
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) updates.sort_order = Number(body.sort_order)

  const { data, error } = await supabase
    .from('featured_banners')
    .update(updates)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx
  const { supabase } = ctx

  const id = req.nextUrl.searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('featured_banners').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
