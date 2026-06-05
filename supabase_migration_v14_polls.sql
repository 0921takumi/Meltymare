-- ============================================================
-- MyFocus Migration v14 — アンケート機能（クリエイターの質問→ファンが投票）
--
-- 背景: 旧「カスタムリクエスト」はファンが自由テキストを送る形式で、
--   不適切なメッセージが届く問題があった。これを廃止し、
--   「クリエイターが質問＋最大4択を作成 → ファンが選んで投票」へ転換する。
--   集計は service_role 側で行い、個別の投票（誰がどれを選んだか）は公開しない。
--
-- すべて IF NOT EXISTS / idempotent。再実行OK。
-- ============================================================

-- アンケート本体（クリエイターが作成）
CREATE TABLE IF NOT EXISTS public.polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  -- 選択肢（文字列の配列、2〜4個）。アプリ側でも検証する。
  options     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 選択肢は 2〜4 個
  CONSTRAINT polls_options_count CHECK (
    jsonb_typeof(options) = 'array'
    AND jsonb_array_length(options) BETWEEN 2 AND 4
  )
);

CREATE INDEX IF NOT EXISTS idx_polls_creator ON public.polls(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_status  ON public.polls(status, created_at DESC);

-- 投票（ファンが回答。1ユーザー1票）
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index INT  NOT NULL CHECK (option_index >= 0 AND option_index < 4),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes(poll_id);

-- ─── RLS ───────────────────────────────────────────────
ALTER TABLE public.polls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes  ENABLE ROW LEVEL SECURITY;

-- polls: 誰でも閲覧可。作成・更新・削除は本人（クリエイター）のみ。
DROP POLICY IF EXISTS "polls_public_read"   ON public.polls;
CREATE POLICY "polls_public_read"   ON public.polls FOR SELECT USING (true);
DROP POLICY IF EXISTS "polls_owner_write"   ON public.polls;
CREATE POLICY "polls_owner_write"   ON public.polls FOR ALL TO authenticated
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- poll_votes: 本人の投票のみ参照・追加できる（個別票は他者に見せない）。
--   集計（何人がどれを選んだか）は service_role 側で行う。
DROP POLICY IF EXISTS "poll_votes_own_select" ON public.poll_votes;
CREATE POLICY "poll_votes_own_select" ON public.poll_votes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "poll_votes_own_insert" ON public.poll_votes;
CREATE POLICY "poll_votes_own_insert" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 完了
-- ============================================================
