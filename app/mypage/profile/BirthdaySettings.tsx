'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cake } from 'lucide-react'
import { apiErrorMessage, NETWORK_ERROR_MESSAGE } from '@/lib/api-error'

/**
 * クリエイター向け: バースデーページ（/birthdays）への誕生日の公開設定。
 *
 * 表示に使う誕生日は「本人確認で登録した生年月日」の月日だけ（年・年齢は出さない）。
 * 生年月日や公開設定は v22 で一般の読み取り権限を外した列なので、/api/me（本人限定）で読み書きする。
 * 切り替えは押した時点で保存する（プロフィール全体の「保存する」とは独立）。
 */
export default function BirthdaySettings() {
  const [loaded, setLoaded] = useState(false)
  const [birthdate, setBirthdate] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        if (!res.ok) { if (!cancelled) setMessage({ kind: 'error', text: await apiErrorMessage(res, '設定を読み込めませんでした') }); return }
        const { profile } = await res.json()
        if (cancelled) return
        setBirthdate(profile?.birthdate ?? null)
        setIsPublic(profile?.birthday_public === true)
      } catch {
        if (!cancelled) setMessage({ kind: 'error', text: NETWORK_ERROR_MESSAGE })
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const save = async (patch: { birthday_public?: boolean; accepts_birthday_messages?: boolean }, okText: string) => {
    // 押した瞬間に見た目を切り替え、失敗したら元に戻す。保存完了まで切り替わらないと、
    // その間「押しても反応しない」ように見える。
    const previous = isPublic
    if (typeof patch.birthday_public === 'boolean') setIsPublic(patch.birthday_public)
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        setIsPublic(previous)
        setMessage({ kind: 'error', text: await apiErrorMessage(res, '保存に失敗しました') })
        return
      }
      const j = await res.json()
      setIsPublic(j.birthday_public === true)
      setMessage({ kind: 'ok', text: okText })
    } catch {
      setIsPublic(previous)
      setMessage({ kind: 'error', text: NETWORK_ERROR_MESSAGE })
    } finally {
      setSaving(false)
    }
  }

  // 月日だけを表示用に取り出す（年は表示しない）
  const monthDay = (() => {
    if (!birthdate) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate)
    return m ? `${Number(m[2])}月${Number(m[3])}日` : null
  })()

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--mm-ink)', cursor: saving ? 'wait' : 'pointer', lineHeight: 1.6 }

  return (
    <section className="mm-card" style={{ padding: 20, marginTop: 24 }} aria-labelledby="birthday-settings-title">
      <h2 id="birthday-settings-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
        <Cake size={18} color="#db2777" /> バースデー設定
      </h2>
      <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 14 }}>
        公開すると、<Link href="/birthdays" style={{ color: 'var(--mm-primary)', fontWeight: 700 }}>バースデーページ</Link>にあなたの誕生日（月日のみ）が表示されます。生まれた年と年齢は表示されません。
      </p>

      {!loaded ? (
        <p style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>読み込み中…</p>
      ) : !birthdate ? (
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', background: '#f8fafc', border: '1px solid var(--mm-border)', borderRadius: 8, padding: '12px 14px' }}>
          生年月日が登録されていません。誕生日は本人確認で登録した生年月日を使います。
          <Link href="/creator/verification" style={{ display: 'inline-block', marginLeft: 6, color: 'var(--mm-primary)', fontWeight: 700 }}>本人確認へ →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#334155' }}>登録されている誕生日: <strong style={{ color: 'var(--mm-ink)' }}>{monthDay}</strong></p>
          <label style={rowStyle}>
            <input
              type="checkbox"
              checked={isPublic}
              disabled={saving}
              onChange={e => save({ birthday_public: e.target.checked }, e.target.checked ? 'バースデーページに公開しました' : 'バースデーページへの公開をやめました')}
              style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--mm-primary)' }}
            />
            <span>バースデーページに誕生日を公開する</span>
          </label>
          {/* お祝いメッセージの受付切り替え(accepts_birthday_messages)は、ファンが送る画面がまだ無いため置かない。
              送信画面を作るときに、ここへ切り替えを足す（API は対応済み）。 */}
        </div>
      )}

      {saving && <p style={{ fontSize: 12, color: '#334155', marginTop: 10 }}>保存中…</p>}
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} style={{
          fontSize: 13, lineHeight: 1.6, marginTop: 12, padding: '8px 12px', borderRadius: 8,
          background: message.kind === 'error' ? '#fef2f2' : '#ecfdf5',
          color: message.kind === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${message.kind === 'error' ? '#fecaca' : '#a7f3d0'}`,
        }}>{message.text}</p>
      )}
    </section>
  )
}
