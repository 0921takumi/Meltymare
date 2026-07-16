-- ============================================================
-- v42: purchases に購入完了時点の手数料率をスナップショット保存
--
-- 発見した問題:
--   admin/payouts・admin/sales・admin(ダッシュボード)・creator/dashboard の4画面すべてが
--   売上の手数料計算に profiles.fee_rate（クリエイターの「現在」の率）を使っていた。
--   admin がクリエイターの手数料率を変更すると、過去に確定済みの売上（既に振込済みの分を
--   除く未精算分、および累計実績表示）の手数料まで遡って再計算されてしまい、
--   会計上の再現性がない（「あの時いくら手数料を取ったか」が後から変わってしまう）。
--
-- 方針:
--   purchases に fee_rate（購入完了時点のクリエイター手数料率）を追加し、webhook側で
--   completed 確定時に記録する。以後の集計は purchases.fee_rate を優先し、無い場合
--   （このマイグレーション以前の既存行、または無料購入）のみ現在の profiles.fee_rate に
--   フォールバックする。
--
--   チップ(tips)は常に手数料0%固定のため対象外（tipsテーブルにfee_rate列は不要）。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

alter table public.purchases add column if not exists fee_rate integer;

-- 既存の completed 購入は、今わかる唯一の値（クリエイターの現在の率）でバックフィルする。
-- 本来の「その時点の率」は記録されていないため近似だが、以後の変更からは保護される。
update public.purchases pu
set fee_rate = pr.fee_rate
from public.contents c
join public.profiles pr on pr.id = c.creator_id
where pu.content_id = c.id
  and pu.status = 'completed'
  and pu.fee_rate is null;

-- 確認(任意):
--   select count(*) from purchases where status='completed' and fee_rate is null;
--   → 0件になっていること（バックフィル漏れがないか）。
-- ============================================================
