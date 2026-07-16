-- ============================================================
-- v40: 単発チップ(tips)をクリエイター振込の集計・精算に組み込む
--
-- 発見した問題（Stripe監査で確定）:
--   TipButton → /api/tip の単発チップは Stripe で実課金され tips.status='completed'
--   になるが、金額集計(admin/payouts・creator/dashboard・admin/sales)は全て
--   purchases テーブルしか見ておらず、tips テーブルを一切参照していなかった。
--   さらに tips には purchases.payout_id に相当する精算紐付けカラムが無かった。
--   結果、ファンから徴収した単発チップがクリエイター振込に一切計上されず、
--   Stripe入金 > DB上の支払予定 が単発チップ分だけ恒常的に乖離していた。
--   （本番の単発チップは現状0件のため過去分バックフィルは不要。実データが
--    流入する前に配線するのが最も安全なタイミング）。
--
--   チップは purchases 付随チップと同じく「手数料0%・全額クリエイターへ」の扱い。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

alter table public.tips
  add column if not exists payout_id uuid references public.payouts(id) on delete set null;

create index if not exists tips_payout_id_idx on public.tips(payout_id);
create index if not exists tips_creator_status_idx on public.tips(creator_id, status);

-- 確認(任意):
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='tips' and column_name='payout_id';
-- ============================================================
