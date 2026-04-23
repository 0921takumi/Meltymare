'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const fetchCount = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) { setCount(0); setLoaded(true) }
        return
      }
      const { count: c } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (mounted) { setCount(c ?? 0); setLoaded(true) }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  if (!loaded) return null

  return (
    <Link href="/notifications"
      style={{ position: 'relative', padding: 8, display: 'inline-flex', alignItems: 'center', color: 'var(--mm-text-sub)' }}>
      <Bell size={18} />
      {count > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 2,
          background: '#dc2626', color: 'white',
          fontSize: 10, fontWeight: 700,
          minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>{count > 99 ? '99+' : count}</span>
      )}
    </Link>
  )
}
