/**
 * ContentCard（'use client'）に渡してよい contents の列の単一の真実。
 *
 * 背景（v49・全体検証で発覚）:
 *   一覧・検索・クリエイターページ・コンテンツ詳細の関連コンテンツが軒並み
 *   `select('*', creator:profiles!contents_creator_id_fkey(...))` で contents を取得し、その行を丸ごと
 *   ContentCard に渡していた。ContentCard は Client Component のため、渡された
 *   props は RSC ペイロードとしてそのままブラウザに送られる。`file_url`（購入者
 *   以外がDLしてはいけない実ファイルの保管パス）はContentCard側で一切使われて
 *   いないにもかかわらず、未購入・未ログインの訪問者にまで送信されていた。
 *
 * ⚠️ この配列に列を足す前に、本当にUIで使うか・file_url等の非公開列でないかを
 *    必ず確認すること。
 */
export const CONTENT_CARD_COLUMNS = [
  'id',
  'title',
  'price',
  'thumbnail_url',
  'content_type',
  'stock_limit',
  'sold_count',
] as const

export const CONTENT_CARD_SELECT =
  'id, title, price, thumbnail_url, content_type, stock_limit, sold_count' as const

if (CONTENT_CARD_SELECT !== CONTENT_CARD_COLUMNS.join(', ')) {
  throw new Error('CONTENT_CARD_SELECT が CONTENT_CARD_COLUMNS と一致していません')
}

/** creator 情報付き（一覧・詳細ページの relatedContents 等で使う標準形） */
export const CONTENT_CARD_WITH_CREATOR_SELECT =
  `${CONTENT_CARD_SELECT}, creator:profiles!contents_creator_id_fkey(id, display_name, avatar_url)` as const

/** タグ集計が必要なページ（/contents 一覧）用。tags は公開列（PII ではない）。 */
export const CONTENT_CARD_WITH_CREATOR_AND_TAGS_SELECT =
  `${CONTENT_CARD_SELECT}, tags, creator:profiles!contents_creator_id_fkey(id, display_name, avatar_url)` as const
