-- ============================================================
-- v55: 事前審査(pre-moderation) → 事後審査(post-moderation) へ変更
--
-- 依頼:
--   「審査完了してから販売開始されるのではなく、直接販売されるようにしてほしい。
--     審査に関しては、管理コンソール側に新着販売写真の通知が来るようにしてほしい。」
--
-- 変更前の挙動:
--   出品 → review_status='pending' かつ is_published=false で保存
--   → AI審査/運営審査が approved にするまで、店頭に一切出ず売れない。
--
-- 変更後の挙動:
--   出品 → review_status='pending' のまま、クリエイターが「公開する」を選べば即販売開始。
--   'pending' の意味を「販売停止中」から「販売中・審査は事後」に変更する。
--   AI審査/運営が 'rejected' にした時点で即座に店頭から消え、購入もできなくなる。
--
--   → 審査は「公開のゲート」ではなく「公開後の取り下げ」に役割が変わる。
--     'rejected' が唯一の販売ブロック条件になる。
--
-- 注意:
--   これは事前審査を撤廃する仕様変更のため、ガイドライン違反コンテンツ
--   （18歳未満・無修正等）が一時的に公開される時間帯が発生する。
--   AI審査(/api/moderate)は従来どおり出品直後に走り、違反を検知すれば自動で
--   rejected にして取り下げる。運営は管理コンソールの「新着出品」から
--   実際の販売写真を確認して手動でも取り下げられる。
--
-- Supabase SQL Editor で実行してください。冪等（何度実行しても安全）。
-- ============================================================

-- ── 1) 公開範囲: approved 限定 → rejected 以外を公開 ──
-- v27 で追加した review_status='approved' ゲートを「rejected でなければ公開」に緩める。
drop policy if exists "contents_select" on public.contents;
create policy "contents_select" on public.contents
  for select
  using (
    (is_published = true and coalesce(review_status, 'approved') <> 'rejected')
    or creator_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 2) 公開フラグの保護条件を緩和 ──
-- v28 のトリガーは「approved 以外は is_published=true にできない」ため、
-- pending のまま公開する新仕様だと編集保存のたびに非公開へ戻されてしまう。
-- 販売を止めるべきなのは rejected のときだけなので、そこだけ塞ぐ。
-- （review_status / sold_count / creator_id の自己書き換え防止は従来どおり維持）
create or replace function public.protect_contents_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  if actor is null or coalesce(current_setting('myfocus.trusted_content_update', true), '') = 'true' then
    return new;
  end if;

  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;
  end if;

  new.creator_id := old.creator_id;
  new.sold_count := old.sold_count;

  if new.review_status is distinct from old.review_status then
    new.review_status := old.review_status;
  end if;

  -- v55: 却下済みのものだけは、クリエイター操作で再公開させない。
  -- （再審査に出すには従来どおり resubmit_content_for_review() を使う）
  if new.is_published = true and old.is_published = false
     and coalesce(old.review_status, 'pending') = 'rejected' then
    new.is_published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_contents_moderation_columns_trg on public.contents;
create trigger protect_contents_moderation_columns_trg
  before update on public.contents
  for each row execute function public.protect_contents_moderation_columns();

-- 確認:
--   1. クリエイターで出品(公開ON) → 別アカウントの一覧/詳細に即座に出て購入できること。
--   2. 管理者が却下 → 一般ユーザーから即座に見えなくなり、購入も 404 になること。
--   3. 却下済みをクリエイターが編集して「公開する」にしても公開されないこと。
