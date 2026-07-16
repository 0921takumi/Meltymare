import { redirect } from 'next/navigation'

// 旧「リクエスト管理」は廃止。アンケート管理へ置き換え。
export default function CreatorRequestsRedirect() {
  redirect('/creator/polls')
}
