export default function ContentsLoading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      {/* ヘッダースケルトン */}
      <div style={{ height: 60, background: 'white', borderBottom: '1px solid var(--mm-border)' }} />

      <div className="mm-page-pad" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* タイトル */}
        <div style={{ marginBottom: 24 }}>
          <div style={sk(160, 22, 8)} />
          <div style={sk(80, 14)} />
        </div>
        {/* フィルター */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[80, 70, 90, 80, 100].map((w, i) => <div key={i} style={sk(w, 32, 20)} />)}
        </div>
        {/* グリッド */}
        <div className="mm-content-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mm-card" style={{ overflow: 'hidden' }}>
              <div style={{ ...sk('100%', 0), aspectRatio: '4/3', borderRadius: 0 }} />
              <div style={{ padding: '12px 14px' }}>
                <div style={sk(60, 11, 4)} />
                <div style={sk('90%', 14, 8)} />
                <div style={sk(50, 16, 8)} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{pulse}</style>
    </div>
  )
}

const sk = (w: number | string, h: number, br = 6): React.CSSProperties => ({
  width: typeof w === 'number' ? w : w,
  height: h,
  borderRadius: br,
  background: 'linear-gradient(90deg, #e8eff5 25%, #f5f8fb 50%, #e8eff5 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  marginBottom: 0,
})
const pulse = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`
