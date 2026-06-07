import { defineConfig } from 'vitest/config'

// ユニットテスト設定（純粋関数中心）。
// 入力検証(lib/sanitize)など、Supabase/Redis/Stripe 等の外部依存を持たない
// モジュールのみを対象にする。相対 import を使うためパスエイリアスは不要。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
