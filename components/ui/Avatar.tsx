'use client'

import { useState } from 'react'

/**
 * 円形アバター。avatar_url の読み込みに失敗(404等)したら broken-image グリフを出さず
 * 頭文字フォールバックに切り替える。
 *
 * なぜ Client Component か: onError は関数なので Server Component から <img> に直接
 * 渡せない(Next.js 16 / React 19 で throw)。サーバーページからはこのコンポーネントを
 * 子として使うこと。
 */
export default function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null
  name?: string | null
  size?: number
}) {
  const [ok, setOk] = useState(true)
  const initial = (name ?? '').trim().charAt(0).toUpperCase()

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--mm-primary-light)',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--mm-primary)',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {src && ok ? (
        <img
          src={src}
          alt=""
          onError={() => setOk(false)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initial || null
      )}
    </div>
  )
}
