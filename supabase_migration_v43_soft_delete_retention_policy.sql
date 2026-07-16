-- ============================================================
-- v43: 退会時のデータ保持ポリシー（先方確認済みの決定事項を反映）
--
-- 決定事項:
--   1. 購入済み(ダウンロード可能)なコンテンツは、クリエイターが削除しても消えない
--   2. ユーザーデータは1年保持。その期間内はアカウントを「削除」しても復元できる
--   3. 推し活系(フォロー・コメント・投票・バースデーメッセージ等)の記録は、保持義務が
--      無いため最終的に削除してよい（購入・チップのような会計記録とは異なる）
--
-- 本SQLの範囲: ①の恒久的な保護（スキーマ制約） と ②のためのソフト削除の土台。
-- 1年後の自動パージ（②の期限到来時の匿名化実行・③の完全削除）は別途実装する
-- （今日時点でこの期限に達するデータは存在しないため、緊急度が低く後続タスク）。
-- ============================================================

-- ① purchases.content_id: CASCADE → RESTRICT
--    購入がある content は単体削除はもちろん、creator の profile 削除に伴う
--    contents への連鎖削除（contents.creator_id は on delete cascade のまま）でも
--    「削除しようとするとエラーになり、トランザクション全体が失敗する」ため、
--    販売実績のあるクリエイターのアカウントは事実上ハード削除できなくなる
--    （後続タスクで実装する匿名化パスに強制的に倒される、という安全側の設計）。
alter table public.purchases drop constraint if exists purchases_content_id_fkey;
alter table public.purchases add constraint purchases_content_id_fkey
  foreign key (content_id) references public.contents(id) on delete restrict;

-- ② purchases.user_id / tips.user_id / tips.creator_id: CASCADE → SET NULL
--    会計上保持すべき「いつ・いくら」という取引記録自体は残し、個人への紐付けだけを
--    切り離せるようにする（NOT NULL制約も緩和）。
alter table public.purchases alter column user_id drop not null;
alter table public.purchases drop constraint if exists purchases_user_id_fkey;
alter table public.purchases add constraint purchases_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.tips alter column user_id drop not null;
alter table public.tips drop constraint if exists tips_user_id_fkey;
alter table public.tips add constraint tips_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.tips alter column creator_id drop not null;
alter table public.tips drop constraint if exists tips_creator_id_fkey;
alter table public.tips add constraint tips_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete set null;

-- ③ ソフト削除マーカー（1年間の復活猶予のための土台。アプリ側で「削除申請日時」として使用）
alter table public.profiles add column if not exists deleted_at timestamptz;

-- 確認(必須):
--   1) 何らかのcontentに1件でもcompleted購入がある状態で
--      delete from contents where id = 'そのcontent'; を実行 →
--      foreign key violation (restrict) で拒否されること。
--   2) 同じ状況で、そのcreatorのprofile行を直接deleteしようとしても
--      (contents経由のcascadeが上のRESTRICTに阻まれ) 拒否されること。
-- ============================================================
