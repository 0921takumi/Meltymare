-- ============================================================
-- v29: purchases に payout_id を追加し、振込済み分を追跡できるようにする
--
-- 発見した問題:
--   「振込予定額」(app/creator/dashboard/page.tsx・app/admin/payouts/page.tsx) は
--   クリエイターの completed purchases 全件（開始以来の累計）から手数料を引いた額を
--   毎回計算しており、payouts テーブルへ「どの購入がどの振込に含まれたか」を記録する
--   仕組みが存在しなかった。そのため、一度振込が『完了』になっても、次回このダッシュ
--   ボードを開くとまた同じ（またはそれ以上の）金額が「振込予定額」として表示され続け、
--   二重払い/過大表示を検知する手段が無かった。
--
--   なお app/admin/page.tsx のダッシュボードKPI「未払振込」は、既に
--     supabase.from('purchases').select(...).eq('status','completed').is('payout_id', null)
--   というクエリを書いていた（＝この列が存在する前提で実装されていた）。
--   実際には列が存在しなかったため、このクエリは PostgREST エラーで data=null となり、
--   「未払振込」KPI は本番でずっと ¥0 表示になっていた（本マイグレーションで解消する）。
--
-- 方針:
--   purchases.payout_id（nullable, payouts への外部キー）を追加する。
--   振込が payouts.status='completed' に確定したタイミングで、対象クリエイターの
--   未精算購入(payout_id is null, status='completed')にこの payout_id を一括設定する
--   処理は app/api/admin-payout/route.ts 側で行う（本マイグレーションはスキーマのみ）。
--
-- Supabase SQL Editor で実行してください。冪等（何度実行しても安全）。
-- ============================================================

alter table public.purchases
  add column if not exists payout_id uuid references public.payouts(id) on delete set null;

-- クリエイター別の未精算集計クエリ（payout_id is null）を高速化するための索引。
create index if not exists purchases_payout_id_idx on public.purchases (payout_id);

-- 確認(任意):
--   select payout_id from purchases limit 1; がエラーにならないこと。
