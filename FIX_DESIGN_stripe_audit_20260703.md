# My Focus 修正設計書 — Stripe/決済監査 残タスク（2026-07-03）

> 対象実装者: Sonnet 5 / 作成: 監査＆設計フェーズ
> 前提: 決済単一エージェント監査(13件)＋総点検で確定済みのバグのうち、**まだ未修正のもの**の修正設計。
> 既に修正・デプロイ済みのもの（チップ二重計上・単発チップ配線v40・V38ポリシー群）は本書の対象外。

---

## 0. 現在の適用状況（着手前に必ず確認）

| 項目 | 状態 |
|---|---|
| V38（follows/poll_votes/polls/creator_blocks/stock_limit/requests/subs解約/payouts RLS） | ✅ 適用済み・実地検証8/8 PASS |
| V40（tips.payout_id 列 + チップ配線コード） | ✅ 適用済み・検証済み |
| チップ二重計上（admin 5画面） | ✅ 修正・デプロイ済み |
| V39（メール登録の招待バイパスをDBで封じる） | ⏸ SQL作成済み・**未実行**（本書 §9 参照。要慎重テスト） |
| 本番実データ | 完了購入3件¥5,000 / チップ0 / 返金0（実損失前の段階） |

**重要な運用原則**: このプロジェクトは「APIは業務ルールを検証するがRLSが同じルールを強制していない」バグが頻出する。
新規に write 系の RLS を触る場合は**必ず実地検証（service_role で作った行に対し anon/authenticated セッションで攻撃 → 再試行）**を行うこと。
「SQL完了」の自己申告を鵜呑みにせず、コードだけでなく実DBで確認する。

---

## 1. 🔴 [P0] 孤児 Checkout Session（購入記録なしのStripe課金 / 二重課金）

**ファイル**: `app/api/purchase/route.ts`（L207 sessions.create 付近 / L254 upsert）、`app/api/webhook/route.ts`（L184-187 逆引き失敗ブランチ）

**根本原因**:
- `stripe.checkout.sessions.create()` に `expires_at` を指定していない → Stripe デフォルトで**24時間**支払い可能。
- 再購入時、`purchases` を `upsert({onConflict: user_id,content_id})` で更新し `stripe_payment_intent_id` を**新しい session.id で上書き**する。
- 旧セッションは失効されないまま生き続け、後から支払われると webhook の逆引き（`stripe_payment_intent_id` 一致）が失敗し `console.warn` のみで終了 → **Stripeに課金があるのにDBに購入記録がない**。新旧両セッションが同時に有効なので**二重課金**も原理的に可能。

**修正方針**:
1. **旧セッションの明示失効**: 再購入時、既存の pending purchase があり `stripe_payment_intent_id` が `cs_` で始まる（= session.id）場合、新セッション作成前に `await stripe.checkout.sessions.expire(oldSessionId)` を呼ぶ（try/catchで失敗は警告のみ）。
2. **有効期限の短縮**: `sessions.create` に `expires_at: Math.floor(Date.now()/1000) + 30*60`（最短30分）を指定。※アプリ実コードなので `Date.now()` 使用可。
3. **孤児課金の検知強化**: webhook の「no purchase for session」ブランチ（purchases も tips も見つからない場合）を `console.warn` から**`audit_logs` への記録（action: `payment.orphan_charge`, metadata に session/payment_intent/amount）＋要手動対応フラグ**へ格上げ。将来的に自動返金も検討（本書では記録＋アラートまで）。

**SQL**: 不要（コードのみ）。※ 将来 `purchases.stripe_session_id` を別カラム化するとより堅牢だが、今回は「旧セッション失効」で回避するので必須ではない。

**テスト計画**:
- Checkout を開く→支払わない→5分後に同一コンテンツを再購入→**旧セッションが `expired` になっていること**を Stripe API (`sessions.retrieve`) で確認。
- webhook に「DBに無い payment_intent の charge.refunded/checkout.completed」を流し、`audit_logs` に `payment.orphan_charge` が残ることを確認。

**リスク**: `sessions.expire` は既に completed/expired のセッションに呼ぶとエラーになる → try/catch 必須。冪等性に注意。

---

## 2. 🔴 [P0/要@legal] purchases が ON DELETE CASCADE で物理消滅

**ファイル**: `lib/supabase/schema.sql`（L40-41 FK定義）、`app/api/account/delete/route.ts`（L77 tips削除・L101 profiles削除・L104 auth.users削除）

**根本原因**:
- `purchases.user_id → profiles ON DELETE CASCADE`、`purchases.content_id → contents ON DELETE CASCADE`。
- `account/delete` はコメント（L14-15）で「purchases は会計・法令保持で残存」と宣言しているが、L101 の profiles 削除（さらに L104 auth.users 削除→profiles cascade）で**本人の purchases 全行が cascade 削除される**。
- L77 で tips（完了済み実課金記録）も明示削除。
- クリエイターがコンテンツ削除すると全購入者の purchase 記録も消える。→ Stripe の charge と突合不能。

**修正方針**（**保持 vs 削除の方針は @legal に確認してから確定**。特商法・個情法の保持義務と削除権のバランス）:
- 推奨案（会計保持＋PII匿名化）:
  1. `purchases.user_id` を **nullable + ON DELETE SET NULL** に変更（退会で購入者IDは消えるが金額・日時・content_price等の会計データは残す）。
  2. `purchases.content_id` を **nullable + ON DELETE SET NULL**、かつ購入時に `content_title` スナップショットを `purchases` に追加（コンテンツ削除後も何を売ったか残す）。※ `content_price`/`original_amount` は既に存在。
  3. `tips` も同様（`user_id`/`creator_id` を SET NULL、`account/delete` の L77 tips 物理削除を**匿名化に置換**）。
  4. `account/delete` は purchases/tips を消さない（user_id が SET NULL される設計に任せる）。
  5. contents は購入が存在する場合ハード削除禁止 → **ソフト削除（`is_deleted`/`deleted_at` フラグ）** に変更し、購入者は引き続きアクセス可。

**SQL**: 必要（FK付け替え + カラム追加 + contents ソフト削除フラグ）。既存コードで user_id/content_id 非nullを前提にしている箇所の洗い出しが必要（`grep` で `purchase.user_id`/`content_id` の参照点を確認）。

**テスト計画**: 購入実績のあるテストユーザーを退会 → purchases 行が残り user_id が null になること／admin/sales 合計が遡って減らないこと。

**リスク（高）**: FK付け替えは既存データ・多数のコード参照に影響。段階実施推奨（まずカラム追加＋スナップショット→次にFK変更）。**@legal の保持方針決定が前提**。

---

## 3. 🟡 [P1] 出金ステータスの逆遷移で紐付けが解除されない

**ファイル**: `app/api/admin-payout/route.ts`（PATCH全体、L33-65 の紐付けロジック）

**根本原因**: completed→pending/failed の逆遷移時、`purchases.payout_id`（および v40 で追加した `tips.payout_id`）が付いたまま解除されない → 実際は未振込なのに集計（`is('payout_id', null)`）から永久に除外され、クリエイターへの未払いが不可視化。

**修正方針**:
1. update 前に**現在の status を取得**（`select('status, creator_id, period_start, period_end')`）。
2. 「旧status === 'completed' かつ 新status !== 'completed'」の場合、この payout に紐付く purchases/tips の `payout_id` を `null` に戻す（unlink）。
3. completed 確定時（既存ロジック）は現状維持。
4. （任意強化）completed 確定時、紐付けた purchases+tips の net 合計と `payouts.net_amount` を比較し、乖離があれば `admin_actions` に警告記録。

**SQL**: 不要（コードのみ）。

**テスト計画**: payout を completed→purchases/tips に payout_id 付与を確認→pending に戻す→payout_id が null に戻ることを確認。

---

## 4. 🟡 [P1] webhook が一時DB障害でも200を返しStripe再送が働かない

**ファイル**: `app/api/webhook/route.ts`（L58-65 の catch、L184-187 lookup、L209-212 update失敗）

**根本原因**: すべてのエラーで200を返すため、Supabase瞬断等の一時障害でも Stripe が再送せず、購入が pending のまま恒久ロスト（課金済みなのにコンテンツ未開放・売上未計上）。

**修正方針**:
1. **一時障害（DBエラー: lookupErr, updErr, RPCエラー等）は 500 を返す** → Stripe が自動リトライ（最大3日）。
2. **恒久条件（対応レコードなし＝§1で audit記録／冪等スキップ＝既に completed）だけ 200**。
3. 冒頭 catch も、Stripe署名検証失敗は400のまま、ハンドラ内DB例外は500へ。
4. （運用）pending のまま N分（例: 30分）経過した purchases を検知する監視（cron or 管理画面バッジ）を別途用意。無限リトライ防止のため、ロジックバグ由来の恒久エラーは500にしないよう条件を明確化する。

**SQL**: 不要（コードのみ、監視は別途）。

**テスト計画**: DB接続を一時的に落とした状態で webhook を受け、500 が返り Stripe ダッシュボードで再送されること（またはユニットで updErr 時に throw/500 を確認）。

---

## 5. 🟡 [P1] 手数料率が購入時点でスナップショットされない

**ファイル**: `app/api/webhook/route.ts`（completed確定箇所）、`app/admin/payouts/page.tsx`、`app/admin/sales/page.tsx`、`app/creator/dashboard/page.tsx`

**根本原因**: 振込・売上計算が `profiles.fee_rate` の**現在値**で毎回計算。admin が率を変更すると、既に成立済みの未精算売上の振込額まで遡及変化 → 会計上の再現性なし。

**修正方針**:
1. `purchases` に `fee_rate`（integer, 購入時点の率）を追加。
2. webhook の completed 確定時、当該クリエイターの `fee_rate` を読み `purchases.fee_rate` に書き込む。
3. 既存全集計（admin/payouts, sales, creator/dashboard）を `p.fee_rate ?? profiles.fee_rate ?? FINANCE.defaultFeeRate` のスナップショット優先に変更。
4. 既存データは現在の率でバックフィル（`update purchases set fee_rate = <creatorの現行率>`）。

**SQL**: 必要（カラム追加＋バックフィル）。**§7（集計RPC化）と同時にやると効率的**。

**リスク**: 低〜中。バックフィルは現行率で近似（過去の実際の率は不明なため許容）。

---

## 6. 🟡 [P2] 集計が PostgREST 1000行上限で無言に切り捨て

**ファイル**: `app/admin/payouts/page.tsx`(L20)、`app/admin/sales/page.tsx`(L9)、`app/admin/page.tsx`(L45,59)、`app/creator/dashboard/page.tsx`(L30)

**根本原因**: 全行を取得して JS の reduce で合計しているが、supabase-js は**デフォルト最大1000行**。1001件目以降は無言に欠落し過少表示。

**修正方針**（推奨: DB側集計）:
1. Postgres 関数 or ビューで per-creator の未精算 net、総売上を集計する RPC を作成（例: `get_pending_payouts()`, `get_sales_summary(period)`）。SECURITY DEFINER + admin 限定 or service_role 経由。
2. 各画面を RPC 呼び出しに置換。
3. 暫定策（RPC化まで）: `.range()` ページングで全件取得 or `count('exact')` と件数比較で欠落検知。

**SQL**: 必要（集計RPC/ビュー）。§5 の fee_rate スナップショットと一緒に設計すると集計ロジックが一箇所に集約できる。

**優先度**: 現在3件なので緊急ではないが、ナンバーワン流入で件数が伸びる前に。

---

## 7. ⚪ [P2] 低優先まとめ（コードのみ、まとめて1PRで可）

| # | ファイル | 内容 | 修正方針 |
|---|---|---|---|
| 7-1 | `app/api/webhook/route.ts` L111-118 | チップ completed 更新に0行更新チェックがなく並行/リプレイで通知・監査ログが二重発生 | purchase側(L198-218)と同様に `.eq('status','pending').select('id').maybeSingle()` にし、0行なら return |
| 7-2 | `app/api/subscribe/route.ts` L69-78 | 解約updateが0行でも member_count をデクリメント | update に `.select('id').maybeSingle()` を付け、1行更新時のみ decrement と監査ログ実行 |
| 7-3 | `supabase_migration_v19_revoke_rpc.sql` / `app/api/subscribe/route.ts` | `decrement_member_count` が authenticated 全員に実行許可（任意プランのカウンタ荒らし可） | 解約時のデクリメントを **admin(service_role) クライアント経由**に変更し、authenticated から REVOKE（要SQL）。Phase2停止中だが DELETE 経路は稼働中 |
| 7-4 | `lib/rankings.ts` 全体 | 閲覧者セッションで purchases を集計するため RLS で閲覧者ごとに壊れる/anonで空 | `createAdminClient()`（service_role）で集計し、**順位・件数・display情報のみ返す（生の金額はUIに出さない）**。PII混入に注意 |
| 7-5 | `app/api/webhook/route.ts` L21,34 / `purchase/route.ts` / `tip/route.ts` | Stripeキー・webhook secret を `cleanEnv` 未通過で使用（BOM/CRLF混入で署名検証全滅リスク） | `cleanEnv(process.env.STRIPE_SECRET_KEY)` 等に統一。未設定時はモジュール評価時でなくリクエスト時に明示エラー |
| 7-6 | `app/admin/inquiries/InquiriesList.tsx` L46 | 問い合わせ更新がブラウザclientから直接DB更新で admin_actions 監査ログなし | API route 経由（requireAdmin + admin_actions記録）に変更、or 最低限 audit 追加。RLSは admin限定で穴ではない |

---

## 8. 補足（監査で「問題なし」確認済み・触らないこと）

以下は監査で実確認して**正しく実装されている**。二次被害を避けるため不用意に変更しない:
- webhook 署名検証（生ボディ + stripe-signature、失敗400）
- JPY 通貨単位（円統一、cent換算バグなし）
- 購入金額計算（クーポン割引 floor、amount_mismatch 監査あり）
- purchases の冪等性・楽観ロック・0行更新検知・completed→refunded ホワイトリスト遷移
- metadata 不信設計（session.id と payment_intent 両方で逆引き）
- 部分返金/全額返金の分岐（v36で修正済み、tip側もv40近辺で対応済み）
- apiVersion 固定、無料購入の complete_free_purchase 原子性（v30/v32）

---

## 9. ⏸ 別トラック: V39（メール登録の招待バイパスをDB強制）

**ファイル**: `supabase_migration_v39_enforce_invite_at_db_layer.sql`（作成済み・未実行）

**内容**: `handle_new_user` トリガーで、`app_settings.invite_only=true` かつ provider='email' の場合に招待コードを検証し、無効なら例外で auth.users INSERT ごと拒否。

**未実行の理由**: サインアップ全体を止めかねない。**実行前に必ず以下をこの順で実地テスト**:
1. 正しい招待コードでの通常メール登録（/auth/signup 経由）が成功する。
2. 招待コードなしで直接 `POST {SUPABASE_URL}/auth/v1/signup` を叩くと auth.users が作られず失敗する。
3. Google(OAuth) 登録がこの変更の影響を受けず動く（callback route 側チェックのみ）。
4. 運用ルール: `NEXT_PUBLIC_MYFOCUS_INVITE_ONLY` を切り替える際は `app_settings.invite_only` も同値に更新（片方だけだと案内文とDB強制が食い違う）。

**注意**: この検証はデモアカウント（`*.demo@my-focus.jp`）と使い捨てユーザーで、本番サインアップを壊さないよう慎重に。テスト後に問題なければ実行。

---

## 10. 推奨実施順（依存関係考慮）

1. **§1 孤児Checkout**（コードのみ・money-critical・独立）→ すぐ着手可
2. **§3 payout逆遷移unlink**（コードのみ・独立）→ すぐ着手可
3. **§4 webhook 500返し**（コードのみ・独立）→ すぐ着手可
4. **§7 低優先6件**（コードのみ・1PRでまとめ）→ すぐ着手可
5. **§5 fee_rateスナップショット + §6 集計RPC化**（SQL+コード・関連するので同時設計）
6. **§2 cascade削除**（要@legal方針決定 → SQL+広範なコード影響。方針確定後）
7. **§9 V39**（実地テスト後に実行）

各ステップ完了時に**実地検証（攻撃→再試行 or 実データ確認）**を必須とする。SQLはユーザーがSupabase SQL Editorで実行する運用（本書のSQLはインラインで提示すること、ファイルリンクだけだと実行漏れが起きる）。
