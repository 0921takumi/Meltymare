'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { AUDIENCE_LABELS, type FlatArticle } from '@/lib/help-content'

export default function HelpSearch({ articles }: { articles: FlatArticle[] }) {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 1) return []
    // スペース区切りの AND 検索
    const terms = query.split(/\s+/).filter(Boolean)
    return articles
      .filter((a) => {
        const hay = a.text.toLowerCase()
        return terms.every((t) => hay.includes(t))
      })
      .slice(0, 12)
  }, [q, articles])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search
          size={18}
          color="var(--mm-text-muted)"
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="キーワードで検索（例: 返金、出金、本人確認）"
          aria-label="ヘルプを検索"
          style={{
            width: '100%',
            padding: '14px 44px 14px 46px',
            fontSize: 15,
            borderRadius: 12,
            border: '1px solid var(--mm-border)',
            background: 'var(--mm-surface)',
            color: 'var(--mm-text)',
            outline: 'none',
          }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="クリア"
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {q.trim().length >= 1 && (
        <div
          style={{
            marginTop: 10,
            background: 'var(--mm-surface)',
            border: '1px solid var(--mm-border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {results.length === 0 ? (
            <p style={{ padding: 16, fontSize: 14, color: 'var(--mm-text-muted)' }}>
              「{q}」に一致する記事が見つかりませんでした。お問い合わせフォームからご連絡ください。
            </p>
          ) : (
            results.map((a) => (
              <Link
                key={`${a.categorySlug}-${a.id}`}
                href={`/help/${a.categorySlug}#${a.id}`}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--mm-border)',
                  textDecoration: 'none',
                  color: 'var(--mm-text)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.q}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                  {a.categoryTitle} ・ {AUDIENCE_LABELS[a.audience]}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
