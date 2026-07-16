import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cleanEnv } from '@/lib/config'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // 末尾 CRLF/BOM 混入があると new URL() が throw するため cleanEnv で必ず正規化。
  const appUrl = cleanEnv(process.env.NEXT_PUBLIC_APP_URL) || 'https://my-focus.jp'
  return NextResponse.redirect(new URL('/', appUrl))
}
