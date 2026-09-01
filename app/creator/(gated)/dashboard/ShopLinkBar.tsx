'use client'

import { useState } from 'react'
import { Store, Copy, Check } from 'lucide-react'

/**
 * 自分の販売ページ（一般ユーザーから見える公開ページ）への導線と、そのURLのコピー。
 * 依頼:「クリエイター側から自分の販売商品一覧ページを見れるようにしてほしい。
 *        またそのページのURLをコピーできるようにしてほしい」
 */
export default function ShopLinkBar({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/creator/${username}`

  const copy = async () => {
    // 絶対URL（https://my-focus.jp/creator/xxx）を組み立てて共有できる形にする
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // クリップボードAPIが使えない環境（古いブラウザ・非HTTPS）向けのフォールバック
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mm-card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Store size={18} color="var(--mm-primary)" />
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ fontSize: 13, fontWeight: 700 }}>あなたの販売ページ</p>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          my-focus.jp{path}
        </p>
      </div>
      <a href={path} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'var(--mm-primary)', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
        ページを見る
      </a>
      <button type="button" onClick={copy}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: copied ? '#059669' : 'var(--mm-text-sub)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {copied ? <><Check size={14} /> コピーしました</> : <><Copy size={14} /> URLをコピー</>}
      </button>
    </div>
  )
}
