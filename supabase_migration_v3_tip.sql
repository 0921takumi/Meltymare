-- ============================================================
-- MyFocus Migration v3 — Tip（応援チップ）機能
-- Run this in Supabase SQL Editor
-- ============================================================

-- purchases テーブルにチップ関連カラム追加
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS content_price INTEGER,
  ADD COLUMN IF NOT EXISTS tip_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_percent INTEGER NOT NULL DEFAULT 0;

-- 既存データのバックフィル: content_price に amount をコピー
UPDATE purchases SET content_price = amount WHERE content_price IS NULL;

-- content_price に NOT NULL 制約を追加
ALTER TABLE purchases ALTER COLUMN content_price SET NOT NULL;

-- tip_percent は 0/5/10/15 のいずれか
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_tip_percent_check;
ALTER TABLE purchases
  ADD CONSTRAINT purchases_tip_percent_check
  CHECK (tip_percent IN (0, 5, 10, 15));

-- チップ集計用インデックス
CREATE INDEX IF NOT EXISTS purchases_tip_amount_idx ON purchases(tip_amount) WHERE tip_amount > 0;
