-- ============================================================
-- MyFocus Migration v13 — クリエイターによる購入者ブロック機能
--
-- 目的: クリエイターが特定の購入者（ユーザー）をブロックできるようにする。
--   ブロックされたユーザーは、そのクリエイターのコンテンツを購入できない
--   （購入APIで service_role が creator_blocks を参照して弾く）。
--
-- すべて IF NOT EXISTS / idempotent。再実行OK。既存データに影響なし。
-- ============================================================

-- ブロック関係テーブル
CREATE TABLE IF NOT EXISTS public.creator_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 同じ相手を二重にブロックできない
  UNIQUE (creator_id, blocked_user_id),
  -- 自分自身はブロックできない
  CONSTRAINT creator_blocks_not_self CHECK (creator_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_blocks_creator
  ON public.creator_blocks(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_blocks_blocked
  ON public.creator_blocks(blocked_user_id);

-- RLS
ALTER TABLE public.creator_blocks ENABLE ROW LEVEL SECURITY;

-- クリエイターは「自分が設定したブロック」だけを参照・追加・削除できる。
-- （購入API側の判定は service_role が行うため RLS を回避できる）
DROP POLICY IF EXISTS "creators_manage_own_blocks" ON public.creator_blocks;
CREATE POLICY "creators_manage_own_blocks" ON public.creator_blocks
  FOR ALL
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- 確認用
-- SELECT * FROM public.creator_blocks;

-- ============================================================
-- 完了
-- ============================================================
