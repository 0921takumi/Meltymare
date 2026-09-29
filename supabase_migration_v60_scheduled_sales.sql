-- ============================================================
-- v60: 日時指定の予約販売
--
-- 指定時刻を過ぎたかどうかをRLSで都度判定するため、cronは不要。
-- 既存商品はcreated_atを販売開始日時として扱い、従来どおり即時公開を維持する。
-- Supabase SQL Editorで実行してください。冪等。
-- ============================================================

-- ── 1) 販売開始日時 ──
-- ADD時はいったんNULLを許容し、既存行を埋めてからNOT NULLにする。
alter table public.contents
  add column if not exists sale_starts_at timestamptz,
  add column if not exists has_been_on_sale boolean not null default false;

alter table public.contents
  alter column sale_starts_at set default now();

update public.contents
  set sale_starts_at = coalesce(created_at, now())
  where sale_starts_at is null;

-- PostgreSQL固有のinfinityやJavaScriptで扱えない範囲を直接PostgRESTから入れられると、
-- RLSでは公開・アプリではInvalid Dateという不整合になるため既存値を補正して制約化する。
update public.contents
  set sale_starts_at = now()
  where not isfinite(sale_starts_at)
     or sale_starts_at < timestamptz '0001-01-01 00:00:00+00'
     or sale_starts_at > timestamptz '9999-12-31 23:59:59.999999+00';

alter table public.contents
  alter column sale_starts_at set not null;

alter table public.contents
  drop constraint if exists contents_sale_starts_at_finite;
alter table public.contents
  add constraint contents_sale_starts_at_finite check (
    isfinite(sale_starts_at)
    and sale_starts_at >= timestamptz '0001-01-01 00:00:00+00'
    and sale_starts_at <= timestamptz '9999-12-31 23:59:59.999999+00'
  );

-- 既存の販売中商品や購入履歴がある商品は「一度販売開始済み」として固定する。
-- この履歴により、開始済み商品を未来へ戻して既存購入者・通知・Checkoutだけが
-- 開始前情報へ到達する矛盾を、画面を迂回した直接UPDATEでも防ぐ。
update public.contents c
  set has_been_on_sale = true
  where c.has_been_on_sale = false
    and (
      (c.is_published = true
        and coalesce(c.review_status, 'approved') <> 'rejected'
        and coalesce(c.hard_takedown, false) = false
        and c.sale_starts_at <= now())
      or coalesce(c.sold_count, 0) > 0
      or exists (
        select 1 from public.purchases p
        where p.content_id = c.id
          and p.status in ('pending', 'completed', 'refunded')
      )
    );

-- UIと同じ販売開始の不変条件をDB直叩きにも適用する。
-- trigger名をzz_で始め、既存のmoderation保護triggerがis_published/review_statusを
-- 矯正した後の最終値を検査する。
create or replace function public.enforce_sale_start_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  was_available boolean;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_published, false)
      and coalesce(new.review_status, 'approved') <> 'rejected'
      and coalesce(new.hard_takedown, false) = false
      and new.sale_starts_at <= now()
    then
      -- 即時販売の新規商品も、クライアント時刻ではなくDBで実際に販売可能になった時刻に揃える。
      new.sale_starts_at := now();
      new.has_been_on_sale := true;
    else
      new.has_been_on_sale := false;
    end if;
    return new;
  end if;

  was_available := coalesce(old.has_been_on_sale, false) or (
    coalesce(old.is_published, false)
    and coalesce(old.review_status, 'approved') <> 'rejected'
    and coalesce(old.hard_takedown, false) = false
    and old.sale_starts_at <= now()
  );

  if was_available and new.sale_starts_at > now() then
    raise exception 'a sale that has started cannot be scheduled again'
      using errcode = '23514';
  end if;

  if was_available then
    -- 通常編集・非公開化・再公開で新着日時を水増しさせず、元の開始日時を保持する。
    new.sale_starts_at := old.sale_starts_at;
  elsif coalesce(new.is_published, false)
    and coalesce(new.review_status, 'approved') <> 'rejected'
    and coalesce(new.hard_takedown, false) = false
    and new.sale_starts_at <= now()
  then
    -- 古い下書きの初回公開、または予約時刻後に承認された動画は、
    -- 実際に販売可能になったこの時刻を販売開始日時とする。
    new.sale_starts_at := now();
  end if;

  new.has_been_on_sale := was_available or (
    coalesce(new.is_published, false)
    and coalesce(new.review_status, 'approved') <> 'rejected'
    and coalesce(new.hard_takedown, false) = false
    and new.sale_starts_at <= now()
  );
  return new;
end;
$$;

revoke execute on function public.enforce_sale_start_history() from public, anon, authenticated;

drop trigger if exists preserve_started_sale_start_trg on public.contents;
drop trigger if exists zz_enforce_sale_start_history_trg on public.contents;
create trigger zz_enforce_sale_start_history_trg
  before insert or update on public.contents
  for each row execute function public.enforce_sale_start_history();

-- 無料購入はアプリ側SELECT後に商品状態が変わるTOCTOUを、最終確定RPCでも閉じる。
-- contents行をlockして公開条件を再確認してから、クーポン消費と購入確定を同一transactionで行う。
create or replace function public.complete_free_purchase(
  p_user_id uuid,
  p_content_id uuid,
  p_coupon_id uuid,
  p_original_amount integer,
  p_discount_amount integer,
  p_stripe_payment_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_available boolean;
  inc_ok boolean;
begin
  -- SELECT FOR UPDATEだけでなく履歴フラグも同じUPDATEで確定する。これにより、
  -- 開始直前から待機していた別transactionが購入確定後に未来へ戻す競合も閉じる。
  update public.contents c
  set has_been_on_sale = true
  where c.id = p_content_id
    and c.is_published = true
    and coalesce(c.review_status, 'approved') <> 'rejected'
    and coalesce(c.hard_takedown, false) = false
    and c.sale_starts_at <= now()
    and c.price = p_original_amount
  returning true into content_available;

  if content_available is distinct from true then
    return false;
  end if;

  if p_coupon_id is not null then
    select public.increment_coupon_used(p_coupon_id) into inc_ok;
    if inc_ok is distinct from true then
      return false;
    end if;
  end if;

  insert into public.purchases (
    user_id, content_id, amount, content_price, tip_amount, tip_percent,
    original_amount, discount_amount, coupon_id, stripe_payment_intent_id,
    status, delivery_status
  ) values (
    p_user_id, p_content_id, 0, 0, 0, 0,
    p_original_amount, p_discount_amount, p_coupon_id, p_stripe_payment_intent_id,
    'completed', 'pending'
  )
  on conflict (user_id, content_id) do update set
    amount = 0,
    content_price = 0,
    tip_amount = 0,
    tip_percent = 0,
    original_amount = excluded.original_amount,
    discount_amount = excluded.discount_amount,
    coupon_id = excluded.coupon_id,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    status = 'completed',
    delivery_status = 'pending';

  return true;
end;
$$;

revoke all on function public.complete_free_purchase(uuid, uuid, uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.complete_free_purchase(uuid, uuid, uuid, integer, integer, text) to service_role;

-- 有料購入はStripe Checkoutを発行する直前に、販売可能性と価格をDBで再検証し、
-- 「一度販売開始済み」を行lockと同時に確定する。RPC終了後もtriggerの履歴不変条件が
-- 未来への再予約を拒否するため、発行済みCheckoutだけが取り残されない。
create or replace function public.confirm_sale_for_checkout(
  p_content_id uuid,
  p_expected_price integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_available boolean;
begin
  update public.contents c
  set has_been_on_sale = true
  where c.id = p_content_id
    and c.is_published = true
    and coalesce(c.review_status, 'approved') <> 'rejected'
    and coalesce(c.hard_takedown, false) = false
    and c.sale_starts_at <= now()
    and c.price = p_expected_price
  returning true into content_available;

  return coalesce(content_available, false);
end;
$$;

revoke all on function public.confirm_sale_for_checkout(uuid, integer) from public, anon, authenticated;
grant execute on function public.confirm_sale_for_checkout(uuid, integer) to service_role;

-- 公開候補を販売開始日時で絞る検索向けpartial index。
-- now()はIMMUTABLEではないためindex predicateには含めず、クエリ/RLS側で境界判定する。
create index if not exists contents_public_sale_starts_at_idx
  on public.contents (sale_starts_at, created_at desc)
  where is_published = true
    and coalesce(review_status, 'approved') <> 'rejected'
    and coalesce(hard_takedown, false) = false;

-- ── 2) 公開SELECT ──
-- v56以前の野良ポリシーが残る環境でもOR結合で予約ゲートを迂回できないよう削除する。
drop policy if exists "contents_select_published" on public.contents;
drop policy if exists "contents_select" on public.contents;
create policy "contents_select" on public.contents
  for select
  to anon, authenticated
  using (
    (is_published = true
      and coalesce(review_status, 'approved') <> 'rejected'
      and coalesce(hard_takedown, false) = false
      and sale_starts_at <= now())
    or (creator_id = (select auth.uid()) and coalesce(hard_takedown, false) = false)
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ── 3) コメント経由の開始前情報漏えい・操作を遮断 ──
-- comments_selectは従来contentsの公開状態を見ておらず、再予約した商品に既存コメントが
-- あると、商品本体がRLSで隠れていてもコメントだけ直接列挙できた。
drop policy if exists "comments_select" on public.content_comments;
create policy "comments_select" on public.content_comments
  for select
  to anon, authenticated
  using (
    (is_hidden = false or user_id = (select auth.uid()))
    and exists (
      -- contents_selectのRLSを再利用し、一般公開/作成者プレビュー/adminを同じ基準にする。
      select 1 from public.contents c where c.id = content_comments.content_id
    )
  );

drop policy if exists "comments_insert" on public.content_comments;
create policy "comments_insert" on public.content_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.contents c
      where c.id = content_comments.content_id
        and c.is_published = true
        and coalesce(c.review_status, 'approved') <> 'rejected'
        and coalesce(c.hard_takedown, false) = false
        and c.sale_starts_at <= now()
    )
  );

-- v38にあった「返信先は同じ商品内のコメント」という不変条件も維持する。
-- RLS内でcontent_comments自身を再参照すると無限再帰になるため、hardening済みの
-- SECURITY DEFINER triggerで整合性だけを検証し、関数の直接実行権限は公開しない。
create or replace function public.enforce_comment_parent_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1
    from public.content_comments parent_comment
    where parent_comment.id = new.parent_id
      and parent_comment.content_id = new.content_id
  ) then
    raise exception 'parent comment must belong to the same content'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_comment_parent_content() from public, anon, authenticated;

drop trigger if exists enforce_comment_parent_content_trg on public.content_comments;
create trigger enforce_comment_parent_content_trg
  before insert or update of parent_id, content_id on public.content_comments
  for each row execute function public.enforce_comment_parent_content();

-- 投稿者自身の更新・削除も、親商品が現在見える間だけ許可する。
drop policy if exists "comments_update" on public.content_comments;
create policy "comments_update" on public.content_comments
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.contents c where c.id = content_comments.content_id)
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.contents c where c.id = content_comments.content_id)
  );

drop policy if exists "comments_delete" on public.content_comments;
create policy "comments_delete" on public.content_comments
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.contents c where c.id = content_comments.content_id)
  );

-- コメント本体を見られない利用者は、いいねの列挙・追加・削除もできない。
drop policy if exists "comment_likes_select" on public.comment_likes;
create policy "comment_likes_select" on public.comment_likes
  for select
  to anon, authenticated
  using (
    exists (select 1 from public.content_comments cc where cc.id = comment_likes.comment_id)
  );

drop policy if exists "comment_likes_insert" on public.comment_likes;
create policy "comment_likes_insert" on public.comment_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.content_comments cc where cc.id = comment_likes.comment_id)
  );

drop policy if exists "comment_likes_delete" on public.comment_likes;
create policy "comment_likes_delete" on public.comment_likes
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.content_comments cc where cc.id = comment_likes.comment_id)
  );

-- 見えないコメントIDへ直接通報を書き込む経路も閉じる。
drop policy if exists "reports_insert_authed" on public.comment_reports;
create policy "reports_insert_authed" on public.comment_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.content_comments cc where cc.id = comment_reports.comment_id)
  );

-- ── 4) レビュー・特集バナーからの開始前情報漏えいを遮断 ──
-- 公開前商品は隠す一方、通常の販売停止後も購入者がレビューを閲覧・編集できる
-- 既存仕様を維持する。SECURITY DEFINERでcontents RLSの外から必要最小限の真偽だけ返す。
create or replace function public.can_access_content_reviews(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contents c
    where c.id = p_content_id
      and (
        exists (
          select 1 from public.profiles pr
          where pr.id = (select auth.uid()) and pr.role = 'admin'
        )
        or (
          coalesce(c.hard_takedown, false) = false
          and (
            (c.is_published = true
              and coalesce(c.review_status, 'approved') <> 'rejected'
              and c.sale_starts_at <= now())
            or c.creator_id = (select auth.uid())
            or exists (
              select 1 from public.purchases p
              where p.user_id = (select auth.uid())
                and p.content_id = c.id
                and p.status = 'completed'
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_access_content_reviews(uuid) from public;
grant execute on function public.can_access_content_reviews(uuid) to anon, authenticated;

drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews
  for select
  to anon, authenticated
  using (
    public.can_access_content_reviews(reviews.content_id)
  );

drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_access_content_reviews(reviews.content_id)
    and exists (
      select 1 from public.purchases p
      where p.user_id = (select auth.uid())
        and p.content_id = reviews.content_id
        and p.status = 'completed'
    )
  );

drop policy if exists "reviews_update" on public.reviews;
create policy "reviews_update" on public.reviews
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.can_access_content_reviews(reviews.content_id)
    and exists (
      select 1 from public.purchases p
      where p.user_id = (select auth.uid())
        and p.content_id = reviews.content_id
        and p.status = 'completed'
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.can_access_content_reviews(reviews.content_id)
    and exists (
      select 1 from public.purchases p
      where p.user_id = (select auth.uid())
        and p.content_id = reviews.content_id
        and p.status = 'completed'
    )
  );

drop policy if exists "featured_select" on public.featured_banners;
create policy "featured_select" on public.featured_banners
  for select
  to anon, authenticated
  using (
    is_active = true
    and (
      content_id is null
      or exists (select 1 from public.contents c where c.id = featured_banners.content_id)
    )
  );

-- ── 5) 公開前サムネイルの匿名列挙を禁止 ──
-- thumbnailsバケット自体は既存URL互換のためpublicのままにするが、storage APIで
-- 全objectを列挙できるSELECT policyは削除する。URLはtimestamp＋41bit相当の乱数path。
-- Supabase環境によってstorage policy変更がSQL Editorから反映されないことがあるため、
-- 実行後は既知の非空prefixを匿名listしてobject名が0件になることを確認し、
-- 名前が返る場合はDashboardでpolicyを削除する（RLS拒否でもHTTP 200 + []の場合がある）。
drop policy if exists "thumbnails_select" on storage.objects;

-- 確認:
--   1. 既存contentsのsale_starts_atがcreated_atで埋まり、NULLが0件であること。
--   2. 一般ユーザーは未来のsale_starts_atの商品をSELECTできないこと。
--   3. 作成者本人とadminは開始前でもSELECTできること（hard_takedown時はadminのみ）。
--   4. sale_starts_atと現在時刻が同一なら一般ユーザーもSELECTできること（<=境界）。
--   5. 開始前商品へのコメント/いいね/通報/レビュー操作が拒否されること。
--   6. 開始前商品の既存コメント/いいね/レビュー/特集バナーが一般公開されないこと。
--   7. 開始済み商品を日時変更なしで保存してもsale_starts_atが変わらないこと。
--   8. 別商品のコメントIDをparent_idに指定した返信INSERTが23514で拒否されること。
--   9. 既知の非空prefixを匿名でstorage.from('thumbnails').list()しても0件となり、
--      service_roleでは非空になること（RLSはHTTP 200 + []を返す場合がある）。
--  10. infinity・-infinity・BC日時がcontents_sale_starts_at_finiteで拒否されること。
--  11. 即時公開INSERTと予約時刻後の初回公開が、クライアント値ではなくDB now()になること。
--  12. 開始前または未来変更後にcomplete_free_purchase / confirm_sale_for_checkoutがfalseになること。
--  13. 通常の販売停止商品はcompleted購入者がレビューを使え、未購入者には見えないこと。
