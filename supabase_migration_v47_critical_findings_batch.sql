-- ============================================================
-- v47: 「エージェント総出」総点検(20件確定)の🔴最優先4件のうちDB変更が必要な分
--
-- ① resubmit_content_for_review: 'approved'始点にも対応
--    承認済みコンテンツのサムネイル差し替えが無審査で即公開される問題（アプリ側で
--    再審査トリガー条件を拡張済み）に対応するため、'rejected'だけでなく'approved'からも
--    pendingへ戻せるようにする。
-- ============================================================

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
      and review_status in ('rejected', 'approved');

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- 確認(必須):
--   承認済み(approved)のコンテンツに対し、本人セッションで
--   rpc('resubmit_content_for_review', {p_content_id}) を呼ぶと、
--   review_status='pending', is_published=false になること。
-- ============================================================
