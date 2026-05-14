import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, description, category, budget_min, budget_max, deadline } = body

  if (!title || !description || typeof budget_min !== 'number' || typeof budget_max !== 'number' || !deadline) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (budget_min < 500 || budget_max < budget_min) {
    return NextResponse.json({ error: 'invalid_budget' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('request_auctions')
    .insert({
      user_id: user.id,
      title: title.trim().slice(0, 100),
      description: description.trim().slice(0, 1000),
      category: category ?? null,
      budget_min, budget_max,
      deadline,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: inserted.id })
}
