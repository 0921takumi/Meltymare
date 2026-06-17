-- ============================================================
-- v25: ストレージ公開設定（バケットの public 化のみ）
--
-- 経緯:
--   当初は contents/thumbnails に「本人フォルダへの upload」を許可する
--   storage.objects ポリシーを足す予定だったが、本番 Supabase の仕様で
--   SQL Editor からは storage.objects のポリシーを作成できない（"Success"
--   表示でも実際には未反映）ことが判明。
--
--   そのためアップロードは「service_role が署名付きアップロードURLを発行 →
--   クライアントが直接アップロード」方式（/api/me/upload-url・/api/me/avatar）に
--   変更した。これで storage RLS ポリシー整備は不要になった。
--
--   残るのは「表示用バケットの公開化」だけ。以下は管理APIで適用済み・冪等。
--   （写真=avatars、コンテンツのサムネ=thumbnails は公開URLで表示するため public）
-- ============================================================

update storage.buckets set public = true where id = 'avatars';
update storage.buckets set public = true where id = 'thumbnails';

-- 確認:
--   select id, public from storage.buckets where id in ('avatars','thumbnails','contents');
--   contents は非公開のまま（購入者へは署名付きDL URL経由で配信）。
