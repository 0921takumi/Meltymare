-- ============================================================
-- v53: 既にemailが漏れていた実アカウント4件のusernameをランダムに差し替える
--
-- v52でsignup時のusername生成をemail非依存にしたが、それ以前に登録済みの実アカウント
-- (デモ用アカウントは対象外)には、既にemailのローカル部を含むusernameが付いたまま
-- 残っている。/creator/[username] 等の公開URL・表示上、個人情報が見え続けている。
--
-- ⚠️ 注意（実行前に必ず確認）:
--   下から2番目の行は role='creator' のアカウントです。/creator/waboku_shinai.0409_f38411
--   というURLが既に本人のSNS等で公開・共有されている可能性があります。実行するとこの
--   URLは無効になり、新しいURL(/creator/ubb915815cb6e)に変わります。本人への告知が
--   必要か確認してから実行してください。他3件は一般ユーザー(role='user')のため
--   公開URLとしての影響はありません。
-- ============================================================

update public.profiles set username = 'ue9fa1ea1d4b1' where id = 'b5d54cfe-5d12-418a-bbfb-cb9bd614f170'; -- user, was tsukasa1213dayo_b5d54c
update public.profiles set username = 'ufb1de3f0110e' where id = 'dffe3051-40de-4269-b365-e4fd2e7853ed'; -- user, was soborochan0411_dffe30
update public.profiles set username = 'u965640714959' where id = '9328ade9-1f8d-4f6d-8939-669244a623a3'; -- user, was a.la.prima001_9328ad
update public.profiles set username = 'ubb915815cb6e' where id = 'f384118c-2c40-4904-affe-efd7b510a73d'; -- ⚠️ creator, was waboku_shinai.0409_f38411

-- 確認(必須): 実行後、上記4件の username がemailのローカル部を含んでいないこと。
-- ============================================================
