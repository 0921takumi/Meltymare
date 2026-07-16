-- ============================================================
-- v54: 最終監査で確定した残りのRLS/整合性の穴をまとめて塞ぐ
--   (1) coupons を anon が全件列挙できた穴
--   (2) content_comments を投稿者が直接改ざん/移動できた穴 + admin非表示が動いていなかった件
--   (3) 返金時にクーポン使用数を戻す decrement_coupon_used
--   (4) 自由入力テキストのDB層長さ制限（クライアントsanitize迂回対策）
-- 全てSupabase SQL Editorで実行可。冪等。
-- ============================================================

-- ── (1) coupons_select: is_active=true だけを条件にしていたため、anonの匿名クライアントが
--    supabase.from('coupons').select('*') で全クーポン(コード/割引/上限/使用数)を列挙できた。
--    コードの秘匿性・レート制限・クリエイター限定を全て迂回できる状態だった。
--    照会は service_role の /api/coupon (レート制限つき) に一本化済みなので、
--    テーブルのSELECTは「自分のクーポン(creator) or admin」だけに絞る。
drop policy if exists "coupons_select" on public.coupons;
create policy "coupons_select" on public.coupons
  for select
  using (
    auth.uid() = creator_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── (2) content_comments の改ざん防止トリガー。
--    comments_update は USING (auth.uid()=user_id) のみで WITH CHECK も列制限も無く、
--    投稿者が自分の行の is_hidden/body/content_id を anon クライアントで直接書き換えられた
--    （通報非表示の解除、sanitize迂回、別コンテンツへの付け替え）。加えて admin の非表示は
--    session client 経由だと同ポリシーに阻まれ 0 行更新＝機能していなかった
--    （API側は service_role 経由に修正済み）。
--    コメントには編集機能が存在しないため、非admin・非service_role からの
--    保護列の変更は一律で旧値に戻す（v26/v28 と同じ方式）。
create or replace function public.protect_content_comment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  -- service_role / 内部処理は auth.uid() が null → 素通り（admin非表示はここを通る）
  if actor is null then
    return new;
  end if;
  select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
  if coalesce(actor_is_admin, false) then
    return new;
  end if;
  -- 非admin・非service_role: 保護列を旧値に戻す（編集UIは存在しない＝正当な変更が無い）
  new.is_hidden  := old.is_hidden;
  new.body       := old.body;
  new.content_id := old.content_id;
  new.user_id    := old.user_id;
  new.parent_id  := old.parent_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_content_comment_columns_trg on public.content_comments;
create trigger protect_content_comment_columns_trg
  before update on public.content_comments
  for each row execute function public.protect_content_comment_columns();

-- ── (3) decrement_coupon_used: 返金時にクーポンの used_count を戻す（0を下限にclamp）。
--    increment_coupon_used と対。sold_count の decrement_sold_count と同じ非対称是正。
create or replace function public.decrement_coupon_used(coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
    set used_count = greatest(coalesce(used_count, 0) - 1, 0)
    where id = coupon_id;
$$;
revoke execute on function public.decrement_coupon_used(uuid) from public, anon, authenticated;
grant execute on function public.decrement_coupon_used(uuid) to service_role;

-- ── (4) 自由入力テキストのDB層長さ制限。
--    display_name/bio/title/description は unbounded text で、クライアント側 sanitize は
--    PostgREST 直叩きで迂回できた（数MBのbio/titleを保存→自分の公開ページの描画コスト増）。
--    既存行を壊さないよう NOT VALID で「今後の書き込みだけ」に効かせる
--    （上限はクライアント上限より十分大きく設定）。
alter table public.profiles  add constraint profiles_display_name_len  check (char_length(display_name) <= 100)  not valid;
alter table public.profiles  add constraint profiles_bio_len           check (bio is null or char_length(bio) <= 2000) not valid;
alter table public.contents  add constraint contents_title_len         check (char_length(title) <= 200)          not valid;
alter table public.contents  add constraint contents_description_len   check (description is null or char_length(description) <= 5000) not valid;

-- 確認(任意):
--   1. anon で supabase.from('coupons').select('*') が0件になること。
--   2. 一般ユーザーで自分のコメントを update is_hidden=false/body=... しても値が変わらないこと。
--   3. admin の通報非表示(/api/admin-comment action=hide)が実際にis_hidden=trueにできること。
-- ============================================================
