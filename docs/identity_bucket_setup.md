# 本人確認書類ストレージバケット設定ガイド

> 対象: My Focus Supabase プロジェクト
> 作成日: 2026-04-24

## 1. バケット作成

Supabase Dashboard → Storage → New Bucket

| 設定項目 | 値 |
|---|---|
| Bucket name | `identity_documents` |
| Public bucket | **OFF**（必ずprivateに） |
| File size limit | 10 MB |
| Allowed MIME types | `image/jpeg, image/png, image/heic, application/pdf` |

## 2. RLSポリシー

Storage → Policies → New Policy

### INSERT ポリシー（クリエイター本人のみアップロード可）

```sql
CREATE POLICY "Creator can upload own identity documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identity_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('creator', 'user')
  )
);
```

### SELECT ポリシー（本人 + admin のみ閲覧可）

```sql
CREATE POLICY "Own or admin can read identity documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identity_documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);
```

### UPDATE / DELETE ポリシー（admin のみ）

```sql
CREATE POLICY "Admin can manage identity documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'identity_documents'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

## 3. ファイル命名規則

`{user_id}/{document_type}_{timestamp}.{ext}`

例:
- `abc-123-def/idcard_20260424103045.jpg`
- `abc-123-def/selfie_20260424103112.jpg`

## 4. 保管期限

- 承認済み書類: アカウント有効期間 + 5年（犯罪収益移転防止法）
- 却下書類: 却下から1年後に自動削除（要cronジョブ）
- 退会ユーザー: 退会から5年後に削除

## 5. 関連ファイル

- DBマイグレーション: `supabase_migration_v5_identity.sql`
- アップロードUI: `app/creator/verification/page.tsx`
- 管理画面: `app/admin/verifications/page.tsx`
