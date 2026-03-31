-- ============================================================
-- Meltymare DBマイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. profiles テーブルに fee_rate・振込情報カラム追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fee_rate INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT CHECK (bank_account_type IN ('ordinary', 'checking')),
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

-- 2. contents テーブルに review_status カラム追加
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- 3. purchases テーブルに納品関連カラム追加
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered')),
  ADD COLUMN IF NOT EXISTS delivered_file_url TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 4. payouts テーブル作成
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  period_start DATE,
  period_end DATE,
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Supabase Storage バケット作成（Storage画面からも作成可）
-- deliveries バケット（非公開）: 納品ファイル用
INSERT INTO storage.buckets (id, name, public)
VALUES ('deliveries', 'deliveries', false)
ON CONFLICT (id) DO NOTHING;

-- 6. deliveries バケットのRLSポリシー
-- クリエイターがアップロード可能
CREATE POLICY "Creator can upload deliveries"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deliveries'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 購入済みユーザーがDL可能（signed URL経由でサーバーが処理するため、service role のみ許可）
CREATE POLICY "Service role can read deliveries"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deliveries');

-- 7. admin ロールのポリシー例（必要に応じて）
-- profiles の fee_rate を admin だけ更新可能
CREATE POLICY IF NOT EXISTS "Admin can update fee_rate"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 実行後の確認クエリ
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';
