'use client'

import { useTransition } from 'react'
import { moderateContent, type ModerationAction } from './actions'

export default function ModerationButtons({ contentId, currentStatus, isPublished, title }: { contentId: string; currentStatus: string; isPublished: boolean; title: string }) {
  const [pending, start] = useTransition()

  const go = (action: ModerationAction, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    start(async () => {
      const res = await moderateContent(contentId, action)
      if ((res as { error?: string }).error) alert((res as { error: string }).error)
    })
  }

  // 実際に本番で発生した事故: 「承認・公開」だけ確認ダイアログが無く、審査待ちタブで
  // 1件承認するとその行がリストから消えて次の商品がボタンごと同じ画面位置にスライドし、
  // 連続クリックで中身を見ていない商品まで承認してしまっていた（監査ログで実証: 2秒後に
  // 別商品を承認し、7分後に慌てて却下し直した履歴が残っていた）。却下・非公開化と同水準の
  // 確認を入れ、かつ「今どの商品を承認しようとしているか」をダイアログ本文に明示することで、
  // ボタン位置がズレて誤クリックしても押す前に気づけるようにする。
  const approve = () => go('approve', `「${title}」を承認・公開します。よろしいですか？`)

  const reject = () => {
    // 監査で発覚: 却下理由の入力欄が無く、クリエイターに理由が一切伝わらなかった。
    // 本人確認の却下（textarea付きモーダル）と同水準にする（軽量なprompt()で最小実装）。
    const reason = window.prompt('却下理由を入力してください（クリエイターに表示されます）')
    if (reason === null) return  // キャンセル
    if (reason.trim().length < 3) { alert('却下理由を3文字以上入力してください'); return }
    start(async () => {
      const res = await moderateContent(contentId, 'reject', reason)
      if ((res as { error?: string }).error) alert((res as { error: string }).error)
    })
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {currentStatus !== 'approved' && (
        <button
          onClick={approve}
          disabled={pending}
          style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >✓ 承認・公開</button>
      )}
      {currentStatus !== 'rejected' && (
        <button
          onClick={reject}
          disabled={pending}
          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >✗ 却下</button>
      )}
      {isPublished && currentStatus === 'approved' && (
        <button
          onClick={() => go('unpublish', '公開を停止します。よろしいですか？')}
          disabled={pending}
          style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >⏸ 非公開化</button>
      )}
    </div>
  )
}
