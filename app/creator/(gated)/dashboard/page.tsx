import { createClient } from '@/lib/supabase/server'
import { PROFILE_PUBLIC_SELECT } from '@/lib/profile-fields'
import Header from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Eye, EyeOff, ClipboardList, MessageSquare, Tag, ShieldCheck, ShieldAlert, Clock, ExternalLink } from 'lucide-react'
import { FINANCE } from '@/lib/config'
import { fetchAllRows } from '@/lib/fetch-all'

export default async function CreatorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // profile 欠落で .single() が例外→500 になるのを防ぎ、未作成ユーザーは login へ。
  const { data: profile } = await supabase.from('profiles').select(PROFILE_PUBLIC_SELECT).eq('id', user.id).maybeSingle()
  if (!profile) redirect('/auth/login?next=/creator/dashboard')
  // v31: proxy.ts の CREATOR_PREFIXES(needsCreator) は creator||admin を許可するのに、
  // ページ本体が creator のみを許可していて admin だけ弾かれる二段構えの不整合があった
  // (他のクリエイター管理ページ:coupons/blocks/polls/live/stories と同じパターンに統一)。
  if (profile.role !== 'creator' && profile.role !== 'admin') redirect('/contents')

  const { data: contents } = await supabase
    .from('contents')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  const contentIds = contents?.map(c => c.id) ?? []
  // v42: fetchAllRows で PostgREST のデフォルト行数上限による無言の切り捨てを防止
  // （人気クリエイターほど1000件超になり得るため、他画面より優先度が高い）。
  let completedPurchases: any[] = []
  let purchasesError: { message: string } | null = null
  if (contentIds.length > 0) {
    try {
      completedPurchases = await fetchAllRows((from, to) => supabase
        .from('purchases').select('*').in('content_id', contentIds).eq('status', 'completed').range(from, to))
    } catch (e) {
      purchasesError = e as { message: string }
    }
  }
  // クエリ障害時に売上¥0を「正常な空」として誤表示しないよう、障害はログに残す。
  if (purchasesError) {
    console.error('[creator/dashboard] purchases query failed:', purchasesError.message, 'creator:', user.id)
  }

  const pendingCount = completedPurchases?.filter(p => (p as any).delivery_status === 'pending').length ?? 0

  // v48: 以下4クエリは互いに独立しているのに直列awaitされておりページ読み込みが
  // 遅くなっていた（Supabase往復1回あたり150〜500ms、直列だと単純合算される）。
  // Promise.allでまとめて並列化する。
  const [
    { data: standaloneTips },
    { data: myPayouts },
    { data: birthdayMessages },
    { count: openPollCount },
  ] = await Promise.all([
    // v40: 単発チップ(tipsテーブル)はコンテンツ購入とは別レコード。以前は集計から
    // 完全に漏れており、ファンが送ったチップがダッシュボードにも振込予定にも現れなかった。
    // チップは手数料0%で全額クリエイターへ（購入付随チップと同じ扱い）。
    supabase.from('tips').select('amount, payout_id').eq('creator_id', user.id).eq('status', 'completed'),
    // 監査で発覚: payouts テーブルのRLS(v38)は本人が自分の振込レコードを読めるよう
    // 既に許可されているのに、フロントエンドがどこも消費しておらず、振込ステータス
    // （特にfailed）を確認する手段がクリエイター側に一切無かった。
    supabase.from('payouts')
      .select('id, status, net_amount, fee_amount, period_start, period_end, paid_at, created_at')
      .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(10),
    // 監査で発覚: バースデーメッセージを受け取る画面がアプリ内に一つも無く、DBに
    // 保存されるだけで機能が完全にブラックホール化していた。ダッシュボードに直近分を表示する。
    supabase.from('birthday_messages')
      .select('id, message, year, created_at, user:profiles!birthday_messages_user_id_fkey(display_name, avatar_url)')
      .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(5),
    // 公開中アンケート件数（polls 未作成時は null → 0 表示）
    supabase.from('polls').select('id', { count: 'exact', head: true }).eq('creator_id', user.id).eq('status', 'open'),
  ])

  // コンテンツ売上（商品代金のみ、チップ除く） / チップ売上 / 販売件数
  // チップ売上 = 購入付随チップ(purchases.tip_amount) + 単発チップ(tipsテーブル)
  const contentSales = completedPurchases?.reduce((sum, p) => sum + ((p as any).content_price ?? p.amount ?? 0), 0) ?? 0
  const attachedTipSales = completedPurchases?.reduce((sum, p) => sum + ((p as any).tip_amount ?? 0), 0) ?? 0
  const standaloneTipSales = (standaloneTips ?? []).reduce((sum, t) => sum + ((t as any).amount ?? 0), 0)
  const tipSales = attachedTipSales + standaloneTipSales
  const tipCount = (completedPurchases?.filter(p => ((p as any).tip_amount ?? 0) > 0).length ?? 0) + (standaloneTips?.length ?? 0)
  const totalSold = completedPurchases?.length ?? 0

  const feeRate = profile?.fee_rate ?? FINANCE.defaultFeeRate
  // v42: 手数料は「今の」profile.fee_rateではなく、購入完了時点のスナップショット
  // (purchases.fee_rate)を優先して1件ずつ計算する。admin が手数料率を変更しても、
  // 既に確定した過去の売上の手数料額が遡って変わらないようにするため。
  const perPurchaseFee = (p: any) => {
    const price = p.content_price ?? p.amount ?? 0
    const rate = p.fee_rate ?? feeRate
    return Math.floor(price * rate / 100)
  }
  // 手数料はコンテンツ売上にのみかかる（チップは手数料0%、全額クリエイターへ）
  const feeAmount = completedPurchases.reduce((sum, p) => sum + perPurchaseFee(p), 0)
  const totalSales = contentSales + tipSales

  // v29/v40: 「振込予定額」は既に振込済み(payout_id 設定済み)の購入・チップを除いた
  // 未払い分のみで計算する。累計(contentSales/tipSales/feeAmount)は実績表示のため残す。
  const unpaidPurchases = completedPurchases.filter(p => (p as any).payout_id == null)
  const unpaidContentSales = unpaidPurchases.reduce((sum, p) => sum + ((p as any).content_price ?? p.amount ?? 0), 0)
  const unpaidAttachedTip = unpaidPurchases.reduce((sum, p) => sum + ((p as any).tip_amount ?? 0), 0)
  const unpaidFee = unpaidPurchases.reduce((sum, p) => sum + perPurchaseFee(p), 0)
  const unpaidStandaloneTip = (standaloneTips ?? []).filter(t => (t as any).payout_id == null).reduce((sum, t) => sum + ((t as any).amount ?? 0), 0)
  const netAmount = (unpaidContentSales - unpaidFee) + unpaidAttachedTip + unpaidStandaloneTip

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Header user={profile} />

      <div className="mm-page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* 本人確認バナー */}
        {(() => {
          const s = (profile as any)?.identity_status ?? 'unsubmitted'
          if (s === 'approved') return null
          const config: Record<string, { bg: string; border: string; iconColor: string; Icon: any; title: string; desc: string; cta: string }> = {
            unsubmitted: { bg: '#fef2f2', border: '#fecaca', iconColor: '#dc2626', Icon: ShieldAlert, title: '本人確認が未提出です', desc: 'コンテンツを公開販売するには本人確認（年齢確認）が必要です。', cta: '本人確認を行う →' },
            pending:     { bg: '#fff7ed', border: '#fed7aa', iconColor: '#d97706', Icon: Clock,       title: '本人確認 審査中', desc: '運営で確認中です。通常2〜3営業日以内に結果をお知らせします。', cta: '申請内容を確認 →' },
            rejected:    { bg: '#fef2f2', border: '#fecaca', iconColor: '#dc2626', Icon: ShieldAlert, title: '本人確認が却下されました', desc: '書類に不備がありました。再提出をお願いします。', cta: '再提出する →' },
          }
          const c = config[s] ?? config.unsubmitted
          const CIcon = c.Icon
          return (
            <Link href="/creator/verification" style={{ textDecoration: 'none' }}>
              <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                <CIcon size={22} color={c.iconColor} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: c.iconColor }}>{c.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginTop: 2 }}>{c.desc}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.iconColor }}>{c.cta}</span>
              </div>
            </Link>
          )
        })()}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>管理ダッシュボード</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/creator/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, background: pendingCount > 0 ? '#d97706' : 'white', color: pendingCount > 0 ? 'white' : 'var(--mm-primary)', border: `1px solid ${pendingCount > 0 ? '#d97706' : 'var(--mm-primary)'}`, padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <ClipboardList size={15} /> 注文管理{pendingCount > 0 ? ` (未納品 ${pendingCount}件)` : ''}
            </Link>
            <Link href="/creator/polls" style={{ display: 'flex', alignItems: 'center', gap: 6, background: (openPollCount ?? 0) > 0 ? '#7c3aed' : 'white', color: (openPollCount ?? 0) > 0 ? 'white' : 'var(--mm-text-sub)', border: `1px solid ${(openPollCount ?? 0) > 0 ? '#7c3aed' : 'var(--mm-border)'}`, padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <MessageSquare size={15} /> アンケート{(openPollCount ?? 0) > 0 ? ` (${openPollCount}件)` : ''}
            </Link>
            <Link href="/creator/coupons" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: 'var(--mm-text-sub)', border: '1px solid var(--mm-border)', padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <Tag size={15} /> クーポン
            </Link>
            <Link href="/creator/upload" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--mm-primary)', color: 'white', padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <Plus size={15} /> コンテンツ追加
            </Link>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="mm-creator-stats" style={{ marginBottom: 16 }}>
          {[
            { label: 'コンテンツ数', value: `${contents?.length ?? 0} 件`, color: 'var(--mm-primary)', sub: null },
            { label: '総販売数', value: `${totalSold} 件`, color: '#7c3aed', sub: null },
            { label: 'コンテンツ売上', value: `¥${contentSales.toLocaleString()}`, color: '#059669', sub: '税込' },
            { label: `手数料 (${feeRate}%)`, value: `¥${feeAmount.toLocaleString()}`, color: '#dc2626', sub: '運営取り分' },
            { label: '振込予定額', value: `¥${netAmount.toLocaleString()}`, color: 'var(--mm-primary)', sub: '売上 - 手数料 + チップ' },
          ].map((s, i) => (
            <div key={i} className="mm-card" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
              {s.sub && <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* 応援チップ売上（別枠） */}
        <div className="mm-card" style={{ padding: '18px 20px', marginBottom: 28, background: 'linear-gradient(135deg, #fefaf3 0%, #ffffff 100%)', border: '1px solid #e8d7b4' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: '#8a6a3f', fontWeight: 700, marginBottom: 4 }}>♥ 応援チップ売上</p>
              <p style={{ fontSize: 11, color: '#a78968' }}>チップは手数料0%、全額クリエイターへ還元されます</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#b8956a' }}>¥{tipSales.toLocaleString()}</p>
              <p style={{ fontSize: 11, color: '#a78968', marginTop: 2 }}>{tipCount}件のサポーターから</p>
            </div>
          </div>
        </div>

        {/* バースデーメッセージ（監査で発覚: 従来これを見る手段が皆無だった） */}
        {birthdayMessages && birthdayMessages.length > 0 && (
          <div className="mm-card" style={{ marginBottom: 28 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 15 }}>
              🎂 バースデーメッセージ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {birthdayMessages.map((m: any) => (
                <div key={m.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--mm-border)', display: 'flex', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                    {m.user?.avatar_url ? <img src={m.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700 }}>{m.user?.display_name ?? 'ファン'} <span style={{ fontWeight: 400, color: 'var(--mm-text-muted)' }}>({m.year}年)</span></p>
                    <p style={{ fontSize: 13, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 振込履歴（監査で発覚: 従来これを見る手段が皆無だった） */}
        {myPayouts && myPayouts.length > 0 && (
          <div className="mm-card" style={{ marginBottom: 28 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 15 }}>
              振込履歴
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--mm-bg)' }}>
                    {['対象期間', '振込額', '状態', '振込日'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myPayouts.map(p => {
                    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                      pending: { label: '準備中', color: 'var(--mm-text-muted)', bg: 'var(--mm-bg)' },
                      processing: { label: '処理中', color: '#92400e', bg: '#fef3c7' },
                      completed: { label: '完了', color: '#059669', bg: '#d1fae5' },
                      failed: { label: '失敗（要確認）', color: '#dc2626', bg: '#fee2e2' },
                    }
                    const s = statusMap[p.status] ?? statusMap.pending
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--mm-text-sub)', fontSize: 12 }}>{p.period_start} 〜 {p.period_end}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--mm-primary)' }}>¥{p.net_amount.toLocaleString()}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--mm-text-muted)', fontSize: 12 }}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ja-JP') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* コンテンツ一覧テーブル */}
        <div className="mm-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mm-border)', fontWeight: 700, fontSize: 15 }}>
            コンテンツ一覧
          </div>
          {!contents || contents.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--mm-text-muted)' }}>
              <p style={{ marginBottom: 12 }}>まだコンテンツがありません</p>
              <Link href="/creator/upload" style={{ color: 'var(--mm-primary)', fontWeight: 600, fontSize: 14 }}>
                最初のコンテンツを追加 →
              </Link>
            </div>
          ) : (
            <div className="mm-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--mm-bg)' }}>
                  {['タイトル', '種別', '価格', '在庫', '販売数', '状態', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contents.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--mm-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: c.content_type === 'video' ? '#ede9fe' : 'var(--mm-primary-light)', color: c.content_type === 'video' ? '#7c3aed' : 'var(--mm-primary)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                        {c.content_type === 'video' ? '動画' : '画像'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--mm-primary)' }}>¥{c.price.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--mm-text-sub)' }}>{c.stock_limit ?? '無制限'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--mm-text-sub)' }}>{c.sold_count}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {/* 監査で発覚: is_publishedの二値だけでは「審査中」「却下」「承認済みだが
                          非公開」が全部同じ「非公開」表示になり、却下されたことにクリエイターが
                          気づく手段が無かった。review_statusを優先して表示する。 */}
                      {c.review_status === 'pending' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                          <Clock size={13} /> 審査中
                        </span>
                      ) : c.review_status === 'rejected' ? (
                        <div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                            <ShieldAlert size={13} /> 却下（要修正）
                          </span>
                          {/* 監査で発覚: 却下理由が編集画面に入らないと見えず、一覧では
                              「却下」とだけ表示されて理由に気づけなかった。一覧にも表示する。 */}
                          {c.rejection_reason && (
                            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4, maxWidth: 220, lineHeight: 1.4 }}>
                              理由: {c.rejection_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.is_published ? '#059669' : 'var(--mm-text-muted)', fontWeight: 600 }}>
                          {c.is_published ? <><Eye size={13} /> 公開</> : <><EyeOff size={13} /> 非公開</>}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* 依頼で追加: 販売中コンテンツの詳細（写真・文言・残数）を確認する手段が
                            編集フォームしか無かった。/contents/[id] は本人(isOwner)なら
                            未公開/審査中でも全文閲覧できる設計なので、そこへのリンクを出す。 */}
                        <Link href={`/contents/${c.id}`} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mm-text-sub)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                          <ExternalLink size={13} /> 詳細を見る
                        </Link>
                        <Link href={`/creator/upload?edit=${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mm-primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                          <Edit size={13} /> 編集
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
