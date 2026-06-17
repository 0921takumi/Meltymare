-- ============================================================
-- v24: avatars バケットを公開化（プロフィール写真表示バグの修正）
--
-- 症状: プロフィール写真を設定しても表示が壊れる。
-- 原因: 本番で 'avatars'（および 'thumbnails'）バケットが public=false の
--       ままだったため、getPublicUrl のURLが 400 を返し画像が表示できない。
--       さらに旧アバターアップロードは storage RLS に阻まれて失敗していた
--       （→ アップロードは /api/me/avatar の service_role 経由に変更済み）。
--
-- 本SQLは avatars を公開化する。プロフィール写真は公開情報なので妥当。
-- ※ 既に管理APIで適用済み。冪等なので再実行しても安全。
-- ============================================================

update storage.buckets set public = true where id = 'avatars';

-- 確認:
-- select id, public from storage.buckets where id = 'avatars';
