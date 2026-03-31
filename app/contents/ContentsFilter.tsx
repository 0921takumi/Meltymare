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

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    border: `1px solid ${active ? 'var(--mm-primary)' : 'var(--mm-border)'}`,
    background: active ? 'var(--mm-primary)' : 'white',
    color: active ? 'white' : 'var(--mm-text-sub)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s',
  })

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 種別 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {typeOptions.map(o => (
          <button key={o.value} onClick={() => update('type', o.value)} style={chipStyle(currentType === o.value)}>
            {o.label}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--mm-border)', margin: '0 6px' }} />
        {sortOptions.map(o => (
          <button key={o.value} onClick={() => update('sort', o.value)} style={chipStyle(currentSort === o.value)}>
            {o.label}
          </button>
        ))}
      </div>

      {/* タグ */}
      {popularTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginRight: 4 }}>タグ:</span>
          {currentTag && (
            <button onClick={() => update('tag', '')} style={{ ...chipStyle(true), background: '#7c3aed', borderColor: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4 }}>
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
