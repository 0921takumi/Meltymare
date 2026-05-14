/**
 * Loading フォールバック。
 * カメラのファインダー枠が回転、中央に控えめなブランドネーム。
 */
export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--mm-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="mm-grain" aria-hidden />
      <div style={{ textAlign: 'center', position: 'relative' }}>
        {/* カメラフレーム風スピナー */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
          <span style={{ position: 'absolute', top: 0, left: 0, width: 18, height: 18, borderTop: '2px solid var(--mm-primary)', borderLeft: '2px solid var(--mm-primary)' }} />
          <span style={{ position: 'absolute', top: 0, right: 0, width: 18, height: 18, borderTop: '2px solid var(--mm-primary)', borderRight: '2px solid var(--mm-primary)' }} />
          <span style={{ position: 'absolute', bottom: 0, left: 0, width: 18, height: 18, borderBottom: '2px solid var(--mm-primary)', borderLeft: '2px solid var(--mm-primary)' }} />
          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderBottom: '2px solid var(--mm-primary)', borderRight: '2px solid var(--mm-primary)' }} />
          {/* 中央のドット（パルス） */}
          <span style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--mm-primary)',
            animation: 'mm-pulse 1.4s ease-in-out infinite',
          }} />
        </div>
        <p className="font-serif-display" style={{
          fontSize: 20, fontWeight: 500, fontStyle: 'italic',
          color: 'var(--mm-ink)',
          letterSpacing: '0.02em',
        }}>My Focus</p>
        <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, marginTop: 6 }}>
          Loading...
        </p>
        <style>{`
          @keyframes mm-pulse {
            0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.85); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          }
        `}</style>
      </div>
    </div>
  )
}
