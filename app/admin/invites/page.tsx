import { createClient } from '@/lib/supabase/server'
import InviteManager from './InviteManager'
import { SERVICE_MODE } from '@/lib/config'

export const dynamic = 'force-dynamic'

interface InviteRow {
  id: string
  code: string
  note: string | null
  max_uses: number
  used_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export default async function AdminInvitesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const invites = (data ?? []) as InviteRow[]

  return (
    <div className="admin-page">
      <h1 className="admin-h1">招待コード管理</h1>
      <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 18 }}>
        現在の動作モード: <strong style={{ color: SERVICE_MODE.inviteOnly ? '#dc2626' : '#059669' }}>
          {SERVICE_MODE.inviteOnly ? '🔒 招待制 ON（招待コード必須）' : '🌐 公開モード（誰でも登録可）'}
        </strong>
        <br />
        切替は環境変数 <code style={{ background: 'var(--mm-bg)', padding: '1px 6px', borderRadius: 4 }}>MYFOCUS_INVITE_ONLY=true/false</code> で制御
      </p>

      <InviteManager initialInvites={invites} />
    </div>
  )
}
