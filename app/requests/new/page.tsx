import { redirect } from 'next/navigation'

// 旧「カスタムリクエスト」（ファンの自由テキスト送信）は廃止。アンケート機能へ置き換え。
export default function NewRequestRedirect() {
  redirect('/polls')
}
