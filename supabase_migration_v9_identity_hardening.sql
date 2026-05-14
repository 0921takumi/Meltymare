-- ============================================================
-- MyFocus Migration v9 — Identity Bucket Hardening + Audit
--
-- 目的:
--   1. `identity_documents` バケットの RLS ポリシーを SQL で明示管理（再現性確保）
--   2. 退会ユーザー / 却下書類の自動削除関数 + クリーンアップを実装
--   3. 監査ログの書き込みヘルパ関数を追加
--
-- v1〜v8 適用済みの前提。冪等に書いてあるので再実行OK。
-- ============================================================

-- ------------------------------------------------------------
-- 0. バケット作成（既に Dashboard で作成済みなら no-op）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('identity_documents', 'identity_documents', false)
on conflict (id) do update set public = false;  -- 既にあっても private に強制

-- ファイルサイズと許可MIMEタイプ
update storage.buckets
set
  file_size_limit = 10 * 1024 * 1024,  -- 10MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
where id = 'identity_documents';

-- ------------------------------------------------------------
-- 1. INSERT: 本人のみ自分のフォルダにアップロード可
-- ------------------------------------------------------------
drop policy if exists "identity_upload_self" on storage.objects;
create policy "identity_upload_self" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'identity_documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 2. SELECT: 本人 + admin のみ閲覧可
-- ------------------------------------------------------------
drop policy if exists "identity_select_own_or_admin" on storage.objects;
create policy "identity_select_own_or_admin" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'identity_documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

-- ------------------------------------------------------------
-- 3. UPDATE/DELETE: admin のみ（本人は差し替え不可、再アップは新ファイル名で）
-- ------------------------------------------------------------
drop policy if exists "identity_modify_admin" on storage.objects;
create policy "identity_modify_admin" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'identity_documents'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "identity_delete_admin" on storage.objects;
create policy "identity_delete_admin" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'identity_documents'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ------------------------------------------------------------
-- 4. 自動削除: 却下から1年経過した書類を削除する関数
--    （pg_cron 等で日次実行する想定）
-- ------------------------------------------------------------
create or replace function public.cleanup_rejected_identity_docs()
returns int as $$
declare
  deleted_count int;
begin
  -- profiles の rejected で 1年以上経過したものから user_id を抽出
  with stale as (
    select id::text as user_id
    from public.profiles
    where identity_status = 'rejected'
      and identity_reviewed_at < now() - interval '1 year'
  )
  delete from storage.objects
  where bucket_id = 'identity_documents'
    and (storage.foldername(name))[1] in (select user_id from stale)
  returning 1
  into deleted_count;

  return coalesce(deleted_count, 0);
end;
$$ language plpgsql security definer;

comment on function public.cleanup_rejected_identity_docs is
  '却下から1年経過した本人確認書類を削除（運用上 pg_cron で日次実行を推奨）';

-- ------------------------------------------------------------
-- 5. 監査ログ書き込みヘルパー関数
--    トリガから呼びやすいよう SECURITY DEFINER で公開。
-- ------------------------------------------------------------
create or replace function public.audit_log(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default null
)
returns uuid as $$
declare
  log_id uuid;
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_metadata)
  returning id into log_id;
  return log_id;
end;
$$ language plpgsql security definer;

comment on function public.audit_log is
  '監査ログの書き込みヘルパ（auth.uid()=actor_id で自動記録）';

-- ------------------------------------------------------------
-- 6. profiles.identity_status を変更したら自動で監査ログ
-- ------------------------------------------------------------
create or replace function public.trg_audit_identity_status_change()
returns trigger as $$
begin
  if new.identity_status is distinct from old.identity_status then
    perform public.audit_log(
      'identity.status_change',
      'profile',
      new.id,
      jsonb_build_object(
        'from', old.identity_status,
        'to', new.identity_status,
        'reason', new.identity_rejection_reason
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists audit_identity_status on public.profiles;
create trigger audit_identity_status
  after update on public.profiles
  for each row
  when (old.identity_status is distinct from new.identity_status)
  execute function public.trg_audit_identity_status_change();

-- ------------------------------------------------------------
-- 7. contents.review_status を変更したら自動で監査ログ
-- ------------------------------------------------------------
create or replace function public.trg_audit_content_review_change()
returns trigger as $$
begin
  if new.review_status is distinct from old.review_status then
    perform public.audit_log(
      'content.review_change',
      'content',
      new.id,
      jsonb_build_object(
        'from', old.review_status,
        'to', new.review_status
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists audit_content_review on public.contents;
create trigger audit_content_review
  after update on public.contents
  for each row
  when (old.review_status is distinct from new.review_status)
  execute function public.trg_audit_content_review_change();

-- ============================================================
-- 完了
-- ============================================================
