/**
 * My Focus サービス設定 — 中央管理
 * 仕様変更時はこのファイルを更新すれば全画面に反映される
 */

// ─── 会社情報 ──────────────────────────
export const COMPANY = {
  name: '株式会社91&Co.',
  representative: '島瀬直人',
  postcode: '115-0043',
  address: '東京都北区神谷2-21-7',
  email: 'my-focus@my-focus.jp',
  serviceDomain: 'my-focus.jp',
  serviceName: 'My Focus',
} as const

// ─── 決済・収益 ──────────────────────────
export const FINANCE = {
  /** デフォルト手数料率（%） — クリエイター毎に admin で変更可 */
  defaultFeeRate: 20,
  /** 最低振込金額（円） — これ未満は翌月以降に繰り越し */
  minPayoutYen: 50_000,
  /** 振込サイクル */
  payoutCycle: 'monthly' as const,
  /** 振込手数料負担 */
  payoutFeeBearer: 'creator' as const,
  /** 銀行振込手数料（参考表示用） */
  bankTransferFeeYen: 250,
  /** 返金可能期間（購入後） */
  refundWindowDays: 14,
  /** 通貨 */
  currency: 'JPY' as const,
  /** 最低価格（円） */
  minPriceYen: 100,
} as const

// ─── クリエイター運営 ──────────────────────────
export const CREATOR = {
  /** 1回のアップロードで一度に作成できるコンテンツ上限 */
  uploadBatchLimit: 5,
  /** 年齢確認: 必須最低年齢 */
  minAge: 18,
  /** 本人確認に必要な書類数（顔写真付き身分証なし時） */
  alternateIdRequiredCount: 2,
  /** 本人確認SLA(時間) */
  verificationSlaHours: 48,
} as const

// ─── コンテンツガイドライン ──────────────────────────
export const CONTENT_GUIDELINES = {
  /** 露出を含む画像はモザイク必須 */
  requireMosaic: true,
  /** 禁止カテゴリ */
  forbidden: [
    '児童ポルノ・18歳未満が含まれるコンテンツ',
    '無修正の性器・性行為描写',
    '暴力・自傷・違法薬物の描写',
    '他者の著作権・肖像権を侵害する内容',
    '差別・誹謗中傷・脅迫',
    '実在他者を本人の同意なく扱う性的コンテンツ',
  ],
} as const

// ─── 機能フラグ ──────────────────────────
// 機能の表示/停止を一元管理。false にすると関連UI・ルートが全面的に無効化される。
// （ナビ非表示・ルートはトップへリダイレクト・プロフィールの該当セクション非表示・ヘルプ項目除外）
export const FEATURES: { stories: boolean; live: boolean; auctions: boolean; subscriptions: boolean } = {
  /** ストーリーズ（24時間限定投稿） */
  stories: false,
  /** ライブ配信 */
  live: false,
  /** リクエストオークション（廃止。アンケート機能に置き換え） */
  auctions: false,
  /**
   * 月額サブスクリプション機能
   * 🚨 false: Stripe Subscription未統合のため Phase 2 送り。
   *    本番リリース前に Stripe Subscription Checkout を組み込む必要あり。
   *    現状は /api/subscribe が 503 を返し、関連UIも非表示にする。
   */
  subscriptions: false,
}

// ─── サービスモード ──────────────────────────
export const SERVICE_MODE = {
  /** 招待制（新規登録を制限） */
  inviteOnly: process.env.MYFOCUS_INVITE_ONLY === 'true',
  /** ベータ表記を表示 */
  showBetaBadge: process.env.MYFOCUS_BETA_MODE !== 'false',
  /** メンテナンスモード */
  maintenance: process.env.MYFOCUS_MAINTENANCE === 'true',
} as const

// ─── メール送信元 ──────────────────────────
export const EMAIL = {
  /** 通知メール送信元 — Google Workspace 移行後に切替 */
  fromAddress: process.env.MYFOCUS_MAIL_FROM ?? 'noreply@my-focus.jp',
  fromName: 'My Focus',
  supportAddress: COMPANY.email,
} as const

// ─── 計算ヘルパー ──────────────────────────
/** 売上から手数料を引いた振込額（端数切り捨て） */
export function netPayout(grossYen: number, feeRatePercent: number): number {
  return Math.floor(grossYen * (100 - feeRatePercent) / 100)
}

/** 手数料額 */
export function platformFee(grossYen: number, feeRatePercent: number): number {
  return grossYen - netPayout(grossYen, feeRatePercent)
}

/** 振込可能か（最低金額チェック） */
export function isPayoutAvailable(amountYen: number): boolean {
  return amountYen >= FINANCE.minPayoutYen
}
