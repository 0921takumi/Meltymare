import { redirect } from 'next/navigation'

// 旧「リクエスト一覧」は廃止。アンケート機能へ置き換え。
export default function RequestsRedirect() {
  redirect('/polls')
}
