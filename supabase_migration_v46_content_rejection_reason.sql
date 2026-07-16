-- ============================================================
-- v46: コンテンツ却下理由をクリエイターに伝える仕組みを追加
--
-- 発見: contents には rejection_reason 相当の列が無く、AI審査(app/api/moderate/route.ts)の
--   却下理由は audit_logs.metadata.reason にしか残らない。app/creator配下のどのページも
--   audit_logsを見ないため、クリエイターは「なぜ却下されたか」を一切知る手段がなかった。
--   さらに creator/dashboard の一覧は is_published の二値（公開/非公開）でしか状態を
--   表示しておらず、「審査中」「却下」「承認済みだが非公開」が全て同じ「非公開」表示に
--   なっていた。管理者の手動却下(ModerationButtons)にも理由入力欄自体が無かった。
--
-- 方針: profiles.identity_rejection_reason と同じパターンで contents にも
--   rejection_reason を追加し、AI審査・管理者手動却下の両方から書き込めるようにする。
-- ============================================================

alter table public.contents add column if not exists rejection_reason text;

-- ── submit_moderation_result: 却下理由を受け取って保存する ──
create or replace function public.submit_moderation_result(
  p_content_id uuid,
  p_new_status text,
  p_admin_override boolean default false,
  p_rejection_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
  updated_rows int;
begin
  if p_new_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid review_status: %', p_new_status;
  end if;

  if p_admin_override then
    select (role = 'admin') into actor_is_admin from public.profiles where id = actor;
    if not coalesce(actor_is_admin, false) then
      raise exception 'not authorized for admin override';
    end if;
  end if;

  perform set_config('myfocus.trusted_content_update', 'true', true);

  if p_admin_override then
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end,
          rejection_reason = case when p_new_status = 'rejected' then p_rejection_reason else null end
      where id = p_content_id;
  else
    update public.contents
      set review_status = p_new_status,
          is_published = case when p_new_status = 'rejected' then false else is_published end,
          rejection_reason = case when p_new_status = 'rejected' then p_rejection_reason else null end
      where id = p_content_id
        and creator_id = actor
        and review_status = 'pending';
  end if;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- ── resubmit_content_for_review: 再提出時に古い却下理由をクリア ──
create or replace function public.resubmit_content_for_review(p_content_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  updated_rows int;
begin
  perform set_config('myfocus.trusted_content_update', 'true', true);

  update public.contents
    set review_status = 'pending',
        is_published = false,
        rejection_reason = null
    where id = p_content_id
      and creator_id = actor
      and review_status = 'rejected';

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- 確認(任意):
--   rpc('submit_moderation_result', {p_content_id, p_new_status:'rejected',
--     p_admin_override:true, p_rejection_reason:'テスト理由'}) を admin セッションで呼ぶと
--   contents.rejection_reason に値が入ること。resubmit後はnullに戻ること。
-- ============================================================
