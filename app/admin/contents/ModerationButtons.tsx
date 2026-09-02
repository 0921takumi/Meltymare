'use client'

import { useTransition } from 'react'
import { moderateContent, type ModerationAction } from './actions'

export default function ModerationButtons({ contentId, currentStatus, isPublished, title, hardTakedown = false }: {
  contentId: string
  currentStatus: string
  isPublished: boolean
  title: string
  hardTakedown?: boolean
}) {
  const [pending, start] = useTransition()

  const go = (action: ModerationAction, confirmText?: string, reason?: string) => {
    if (confirmText && !confirm(confirmText)) return
    start(async () => {
      const res = await moderateContent(contentId, action, reason)
      if ((res as { error?: string }).error) alert((res as { error: string }).error)
    })
  }

  // 実際に本番で発生した事故: 「承認・公開」だけ確認ダイアログが無く、審査待ちタブで
  // 1件承認するとその行がリストから消えて次の商品がボタンごと同じ画面位置にスライドし、
  // 連続クリックで中身を見ていない商品まで承認してしまっていた（監査ログで実証: 2秒後に
  // 別商品を承認し、7分後に慌てて却下し直した履歴が残っていた）。却下・非公開化と同水準の
  // 確認を入れ、かつ「今どの商品を承認しようとしているか」をダイアログ本文に明示することで、
  // ボタン位置がズレて誤クリックしても押す前に気づけるようにする。
  const approve = () => go('approve', hardTakedown
    ? `「${title}」は配信停止中です。配信停止を解除したうえで承認・公開します（購入済みユーザーのダウンロードも再開されます）。よろしいですか？`
    : `「${title}」を承認・公開します。よろしいですか？`)

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

  // 納品前監査で発覚: 配信停止だけ confirm が無く、prompt に3文字入れれば即実行され、しかも
  // 解除手段がどこにも無かった（誤操作1回で商品が全員から消え、購入者のDLは永久403）。
  // 他のアクションと同水準の商品名入り confirm を先に出し、そのうえで理由を求める。
  const takedown = () => {
    const ok = confirm(
      `「${title}」を法令違反として配信停止します。\n\n` +
      '・販売停止に加え、購入済みユーザーのダウンロードも止まります（返金対応が必要です）\n' +
      '・公開サムネイルは削除されます（本体ファイルは証拠保全のため残ります）\n' +
      '・解除は「配信停止を解除」または「承認・公開」で行えます\n\n本当に実行しますか？'
    )
    if (!ok) return
    const reason = window.prompt('配信停止の理由を入力してください（記録に残り、クリエイターにも表示されます）')
    if (reason === null) return
    if (reason.trim().length < 3) { alert('理由を3文字以上入力してください'); return }
    go('takedown', undefined, reason)
  }

  const untakedown = () => go('untakedown',
    `「${title}」の配信停止を解除します。\n却下状態に戻るだけで販売は再開されません（再開するには「承認・公開」を押してください）。よろしいですか？`)

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {(currentStatus !== 'approved' || hardTakedown) && (
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
      {hardTakedown ? (
        <button
          onClick={untakedown}
          disabled={pending}
          style={{ background: 'white', color: '#7f1d1d', border: '1px solid #7f1d1d', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
        >配信停止を解除</button>
      ) : (
        <button
          onClick={takedown}
          disabled={pending}
          style={{ background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
        >⛔ 配信停止（法令違反）</button>
      )}
      {/* v55以降は販売中の大半が pending（＝未確認のまま販売中）なので、approved 限定だと
          運営に残る手段が「却下」しかなくなる。却下は再公開に運営承認が要る重い操作なので、
          軽く取り下げる手段として公開中なら常に出す。 */}
      {isPublished && currentStatus !== 'rejected' && (
        <button
          onClick={() => go('unpublish',
            `「${title}」を非公開にします。\nクリエイターは自分で再公開できます（再公開させたくない場合は「却下」を使ってください）。よろしいですか？`)}
          disabled={pending}
          style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >⏸ 非公開化</button>
      )}
    </div>
  )
}
