import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { COMPANY } from '@/lib/config'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f-]{36}$/i
const MAX_NAME_LEN = 60

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 本人が完了済みで行った購入のみ対象。id×user_id×status で所有者チェックを兼ねる。
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('id, amount, created_at, status, content_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .maybeSingle()

  if (error) {
    console.error('[receipt] purchase lookup failed:', error.message, 'purchase_id:', id, 'user:', user.id)
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 納品前監査で発覚: 商品名を RLS 越しの埋め込みで取っていたため、購入後に却下・非公開・
  // 配信停止された商品は埋め込みが null になり、但し書きが「コンテンツ」になっていた
  // （金銭書類として商品名が抜ける実害）。所有者チェックは上の purchases 行で済んでいるので、
  // 商品名だけ service_role で読む。
  const { data: contentRow } = await createAdminClient()
    .from('contents')
    .select('title')
    .eq('id', purchase.content_id)
    .maybeSingle()
  const rawTitle = contentRow?.title ?? 'コンテンツ'
  // タイトルは自由入力(文字数上限なし)。但し書き行の幅に収まるよう安全側で切り詰める。
  const MAX_TITLE_LEN = 40
  const title = rawTitle.length > MAX_TITLE_LEN ? rawTitle.slice(0, MAX_TITLE_LEN) + '…' : rawTitle

  const { searchParams } = new URL(req.url)
  const rawName = (searchParams.get('name') ?? '').trim()
  const recipientName = (rawName || 'お客様').slice(0, MAX_NAME_LEN)

  const purchaseDate = new Date(purchase.created_at)
  const dateLabel = `${purchaseDate.getFullYear()}年${purchaseDate.getMonth() + 1}月${purchaseDate.getDate()}日`
  const receiptNo = purchase.id.replace(/-/g, '').slice(0, 12).toUpperCase()
  const amountLabel = `¥${purchase.amount.toLocaleString('ja-JP')}`

  // fontkitのsubset:trueにはCJKグリフを取りこぼす既知バグがあるため(pdf-lib#1232)、
  // 事前にfonttoolsで日本語+英数字のみへ静的subsetした版をsubset:falseでそのまま埋め込む。
  const fontBytes = await readFile(new URL('../../../../../lib/fonts/NotoSansJP-Subset.otf', import.meta.url))
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const font = await pdfDoc.embedFont(fontBytes, { subset: false })
  const bold = font

  const page = pdfDoc.addPage([595.28, 419.53]) // A5横
  const { width, height } = page.getSize()
  const black = rgb(0.1, 0.1, 0.1)
  const gray = rgb(0.45, 0.45, 0.45)
  const line = rgb(0.82, 0.82, 0.82)

  const draw = (text: string, x: number, y: number, size: number, color = black, useBold = false) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color })
  }

  draw('領収書', 40, height - 60, 26, black, true)
  draw(`No. ${receiptNo}`, 40, height - 82, 9, gray)
  draw(dateLabel, width - 150, height - 60, 11, black)

  draw(`${recipientName} 様`, 40, height - 140, 16, black)
  page.drawLine({ start: { x: 40, y: height - 150 }, end: { x: 300, y: height - 150 }, thickness: 1, color: line })

  draw('下記の通り、正に領収いたしました。', 40, height - 180, 10, gray)

  draw('金額', 40, height - 230, 12, gray)
  draw(amountLabel, 40, height - 255, 28, black, true)
  draw('（消費税等相当額を含む）', 200, height - 246, 9, gray)

  page.drawLine({ start: { x: 40, y: height - 275 }, end: { x: width - 40, y: height - 275 }, thickness: 1, color: line })

  draw('但し書き', 40, height - 300, 10, gray)
  draw(`コンテンツ購入代金として（${title}）`, 40, height - 320, 11, black)

  draw('購入日', 40, height - 350, 10, gray)
  draw(dateLabel, 120, height - 350, 10, black)

  // 発行者（運営名義）
  draw(COMPANY.serviceName, width - 220, 90, 13, black, true)
  draw(COMPANY.name, width - 220, 74, 9, gray)
  draw(`〒${COMPANY.postcode} ${COMPANY.address}`, width - 220, 60, 8, gray)
  draw(COMPANY.email, width - 220, 46, 8, gray)

  const bytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt_${receiptNo}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
