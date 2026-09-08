# ブラウザ実機テスト（Safari / Chrome / Edge / Android）

`npm test`（vitest）は計算のテストで、ブラウザは動かしません。
ここに置いてあるのは、**本物のブラウザエンジンを動かして本番サイトを操作する**テストです。

なぜ必要か: サムネイルの「ぼかし」が iPhone だけ効かない不具合が2度続きました。原因はどちらも
「Chrome では動くが Safari では動かない」もので、計算のテストでも Chrome での目視でも捕まりません。

- **WebKit** = iPhone / iPad / Mac の Safari と同じエンジン
- **Chromium** = Chrome / Edge / Android Chrome
- **Firefox** = Firefox（Windows の実行制限で動かない場合があります）

## 準備

```bash
npm i -D playwright
npx playwright install webkit chromium
node tests/browser/prepare.mjs
```

Playwright はこのリポジトリの依存には入れていません（本番ビルドを重くしないため）。
テストするときだけ入れてください。

## 実行

```bash
node tests/browser/site-crossbrowser.mjs
node tests/browser/blur-e2e.mjs
```

いずれも既定で本番 https://my-focus.jp を見ます。別環境なら `SITE=http://localhost:3000` を付けます。

### site-crossbrowser.mjs（ログイン不要）

- canvas の `ctx.filter` が実際にぼかすか（**WebKit では効かない**ことの証拠。不具合の原因そのもの）
- 置き換えたピクセル演算のぼかしが全エンジンで効くか
- 画像の書き出し（JPEG/PNG）、なぞる操作に必要な API
- サムネイル枠の場所取り（読み込み中は 4:3、読み込み後は写真の縦横比）
- 商品ページ: サムネイルが切り取られない・横スクロールしない・購入導線がある
- 主要ページの横あふれとJSエラー

### blur-e2e.mjs（本番の出品画面を実際に操作）

iPhone SE / iPhone 14 Pro Max / iPad / デスクトップの4サイズで、
ログイン → サムネイル選択 → 加工エディタ → **実際に指でなぞる** → 適用、まで通します。
なぞった範囲が隅々までぼけたかを、画像を6×6の格子に分けて数値で判定します。

**本番の実アカウントには触りません。** 検証専用の使い捨てクリエイターを作り、最後に必ず削除します。
出品（保存）は行わないので、商品テーブルには何も残りません。
`.env.local` の `SUPABASE_SERVICE_ROLE_KEY` を使うため、鍵を持っている人だけが実行できます。

## 直した不具合（このテストで見つけたもの）

| 症状 | 原因 |
|---|---|
| iPhone でぼかしても何も変わらない | canvas の `ctx.filter` を Safari が黙って無視する。ピクセル演算に置き換え |
| なぞった範囲より狭い所だけぼける | 指を離した時の確定に React の state を使っており、最後の描画が間に合わないと1つ前の範囲が確定していた。ref に変更 |
