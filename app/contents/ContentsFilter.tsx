'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Props {
  currentSort: string
  currentType: string
  currentTag: string
  popularTags: string[]
}

function ContentsFilterInner({ currentSort, currentType, currentTag, popularTags }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all' && value !== 'newest') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/contents?${params.toString()}`)
  }

  const sortOptions = [
    { value: 'newest', label: '新着順' },
    { value: 'popular', label: '人気順' },
    { value: 'price_asc', label: '価格：安い順' },
    { value: 'price_desc', label: '価格：高い順' },
  ]

  const typeOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'image', label: '画像' },
    { value: 'video', label: '動画' },
  ]

  // 種別＝塗りチップ、ソート＝下線タブ。両方オレンジ点灯で判別不能だった問題を役割分担で解消
  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 16px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? 'var(--mm-ink)' : 'var(--mm-border)'}`,
    background: active ? 'var(--mm-ink)' : 'white',
    color: active ? 'white' : 'var(--mm-text-sub)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  })

  const sortTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 4px',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--mm-primary)' : '2px solid transparent',
    borderRadius: 0,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--mm-ink)' : 'var(--mm-text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.15s, border-color 0.15s',
  })

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 種別（左）× ソート（右） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {typeOptions.map(o => (
            <button key={o.value} onClick={() => update('type', o.value)} style={chipStyle(currentType === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
          {sortOptions.map(o => (
            <button key={o.value} onClick={() => update('sort', o.value)} style={sortTabStyle(currentSort === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* タグ */}
      {popularTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginRight: 4 }}>タグ:</span>
          {currentTag && (
            <button onClick={() => update('tag', '')} style={{ ...chipStyle(true), display: 'flex', alignItems: 'center', gap: 4 }}>
              #{currentTag} ✕
            </button>
          )}
          {popularTags.filter(t => t !== currentTag).map(tag => (
            <button key={tag} onClick={() => update('tag', tag)} style={chipStyle(false)}>
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ContentsFilter(props: Props) {
  return (
    <Suspense fallback={null}>
      <ContentsFilterInner {...props} />
    </Suspense>
  )
}
