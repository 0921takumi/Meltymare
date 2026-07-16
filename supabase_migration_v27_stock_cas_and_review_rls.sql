-- ============================================================
-- v27: 在庫オーバーセル封じ(CAS) + モデレーション漏れのRLS根本対策
--
-- 発見した脆弱性(深掘りバグ狩り):
--   🔴 B-1 在庫オーバーセル: increment_sold_count が無条件 +1 で stock_limit を
--      チェックしないため、限定1枠に並列購入が来ると sold_count が上限を超える
--      (在庫1を2人に販売)。無料経路でも二重加算。
--   🟡 M-1 モデレーション漏れ: contents_select RLS が is_published のみで
--      review_status を見ないため、rejected/pending が閲覧・検索・OGに露出し得る。
--
-- 本SQLは public スキーマの関数/ポリシーなので Supabase SQL Editor で適用可。冪等。
-- ============================================================

-- ── B-1: increment_sold_count を CAS 化（stock_limit を超えたら加算せず false を返す）──
-- 戻り値型を void→boolean に変えるため一旦 DROP（呼び出し側 webhook/purchase は service_role）。
drop function if exists public.increment_sold_count(uuid);
create function public.increment_sold_count(content_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.contents
    set sold_count = coalesce(sold_count, 0) + 1
    where id = content_id
      and (stock_limit is null or coalesce(sold_count, 0) < stock_limit);
  get diagnostics n = row_count;
  return n > 0;   -- false = 在庫上限到達（加算せず）
end;
$$;

-- ── M-1: contents_select RLS に review_status='approved' ゲートを追加 ──
-- 公開はpublished かつ approved のみ。本人(creator)は自分の全status可、admin は全件可。
drop policy if exists "contents_select" on public.contents;
create policy "contents_select" on public.contents
  for select
  using (
    (is_published = true and coalesce(review_status, 'approved') = 'approved')
    or creator_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 確認:
--   stock_limit=1 のコンテンツに対し increment_sold_count を2回 → 2回目は false。
--   一般ユーザーから review_status='rejected' のコンテンツが select されないこと。
