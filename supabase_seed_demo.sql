-- ============================================================
-- MyFocus デモデータ投入スクリプト
-- Supabase SQL Editor で実行してください
-- 本番環境では絶対に実行しないこと
-- ============================================================

-- FK制約を一時的に無効化（auth.usersを介さずにprofiles投入するため）
SET session_replication_role = replica;

-- 既存のデモデータをクリア（IDプレフィックスで識別）
DELETE FROM reviews      WHERE user_id::text LIKE '2%' OR content_id IN (SELECT id FROM contents WHERE creator_id::text LIKE '1%');
DELETE FROM purchases    WHERE user_id::text LIKE '2%' OR content_id IN (SELECT id FROM contents WHERE creator_id::text LIKE '1%');
DELETE FROM follows      WHERE follower_id::text LIKE '2%' OR creator_id::text LIKE '1%';
DELETE FROM featured_banners WHERE title LIKE 'DEMO:%';
DELETE FROM contents     WHERE creator_id::text LIKE '1%';
DELETE FROM profiles     WHERE id::text LIKE '1%' OR id::text LIKE '2%' OR id::text LIKE '3%';

-- ============================================================
-- 1. クリエイター（女性）20人
-- ============================================================
INSERT INTO profiles (id, email, username, display_name, avatar_url, role, bio, twitter_url, instagram_url, fee_rate, identity_status, birthdate, created_at) VALUES
('10000000-0000-0000-0000-000000000001', 'sakura@demo.local', 'sakura_mikan', 'さくら みかん',   'https://randomuser.me/api/portraits/women/1.jpg',  'creator', '💖 現役女子大生モデル｜チェキとお手紙送ります｜ふわふわ系が得意',     'https://twitter.com/demo1',  'https://instagram.com/demo1',  30, 'approved', '2003-04-12', NOW() - INTERVAL '180 days'),
('10000000-0000-0000-0000-000000000002', 'yuki@demo.local',   'yuki_milk',    '結城 ゆき',        'https://randomuser.me/api/portraits/women/2.jpg',  'creator', '📸 グラビア志望｜コスプレ撮影メイン｜DMもお気軽に♡',                      'https://twitter.com/demo2',  NULL,                            25, 'approved', '2001-08-22', NOW() - INTERVAL '220 days'),
('10000000-0000-0000-0000-000000000003', 'rina@demo.local',   'rina_sugar',   '綾瀬 りな',        'https://randomuser.me/api/portraits/women/3.jpg',  'creator', '🌸 清楚系｜制服フォトとメッセージ動画｜全国のファンとつながりたい',    'https://twitter.com/demo3',  'https://instagram.com/demo3',  30, 'approved', '2002-11-03', NOW() - INTERVAL '150 days'),
('10000000-0000-0000-0000-000000000004', 'mio@demo.local',    'mio_peach',    '白石 みお',        'https://randomuser.me/api/portraits/women/4.jpg',  'creator', '🍑 笑顔がウリ｜バースデー動画・お祝いメッセージ承ります',              'https://twitter.com/demo4',  'https://instagram.com/demo4',  28, 'approved', '2000-02-14', NOW() - INTERVAL '300 days'),
('10000000-0000-0000-0000-000000000005', 'hana@demo.local',   'hana_rose',    '桜井 はな',        'https://randomuser.me/api/portraits/women/5.jpg',  'creator', '🌹 大人っぽい雰囲気｜プライベート写真｜限定コンテンツ販売中',          NULL,                          'https://instagram.com/demo5',  30, 'approved', '1998-06-30', NOW() - INTERVAL '400 days'),
('10000000-0000-0000-0000-000000000006', 'aoi@demo.local',    'aoi_sky',      '橘 あおい',        'https://randomuser.me/api/portraits/women/6.jpg',  'creator', '☁️ 夢見る系｜コスプレ・メイド・制服｜月替わりテーマでお届け',            'https://twitter.com/demo6',  NULL,                            25, 'approved', '2002-01-18', NOW() - INTERVAL '100 days'),
('10000000-0000-0000-0000-000000000007', 'moe@demo.local',    'moe_cute',     '長谷川 もえ',      'https://randomuser.me/api/portraits/women/7.jpg',  'creator', '🎀 アイドル風｜ダンス動画多め｜全力で応援届けます！',                    'https://twitter.com/demo7',  'https://instagram.com/demo7',  30, 'approved', '2003-09-05', NOW() - INTERVAL '90 days'),
('10000000-0000-0000-0000-000000000008', 'nana@demo.local',   'nana_luna',    '三浦 なな',        'https://randomuser.me/api/portraits/women/8.jpg',  'creator', '🌙 大人の色気｜ランジェリー撮影｜18歳以上限定のプレミアムコンテンツ',  'https://twitter.com/demo8',  NULL,                            30, 'approved', '1996-12-11', NOW() - INTERVAL '500 days'),
('10000000-0000-0000-0000-000000000009', 'kana@demo.local',   'kana_lemon',   '藤田 かな',        'https://randomuser.me/api/portraits/women/9.jpg',  'creator', '🍋 爽やか系｜スポーツユニフォーム｜カジュアルフォト',                  NULL,                          'https://instagram.com/demo9',  28, 'approved', '2001-05-23', NOW() - INTERVAL '250 days'),
('10000000-0000-0000-0000-000000000010', 'emi@demo.local',    'emi_chocolat', '中村 えみり',      'https://randomuser.me/api/portraits/women/10.jpg', 'creator', '🍫 甘いもの大好き｜カフェ巡り風フォト｜ほっこり癒し系',                'https://twitter.com/demo10', 'https://instagram.com/demo10', 30, 'approved', '1999-10-08', NOW() - INTERVAL '330 days'),
('10000000-0000-0000-0000-000000000011', 'mei@demo.local',    'mei_berry',    '小林 めい',        'https://randomuser.me/api/portraits/women/11.jpg', 'creator', '🍓 ベリー系｜ピンクとフリルが大好き｜サイン入りチェキ販売中',          'https://twitter.com/demo11', NULL,                            30, 'approved', '2002-07-19', NOW() - INTERVAL '75 days'),
('10000000-0000-0000-0000-000000000012', 'miku@demo.local',   'miku_ice',     '斉藤 みく',        'https://randomuser.me/api/portraits/women/12.jpg', 'creator', '❄️ クール系｜モノクロ写真多め｜アート寄りの表現が好き',                  NULL,                          'https://instagram.com/demo12', 25, 'approved', '2000-03-27', NOW() - INTERVAL '180 days'),
('10000000-0000-0000-0000-000000000013', 'yui@demo.local',    'yui_flower',   '松本 ゆい',        'https://randomuser.me/api/portraits/women/13.jpg', 'creator', '🌼 和風ガール｜浴衣・着物撮影｜季節ごとのテーマフォト',                'https://twitter.com/demo13', 'https://instagram.com/demo13', 30, 'approved', '1997-11-02', NOW() - INTERVAL '600 days'),
('10000000-0000-0000-0000-000000000014', 'ami@demo.local',    'ami_coral',    '渡辺 あみ',        'https://randomuser.me/api/portraits/women/14.jpg', 'creator', '🐚 海好き｜水着・ビーチフォト｜夏のグラビアが得意',                    'https://twitter.com/demo14', 'https://instagram.com/demo14', 30, 'approved', '1999-07-14', NOW() - INTERVAL '280 days'),
('10000000-0000-0000-0000-000000000015', 'lisa@demo.local',   'lisa_neo',     'リサ',             'https://randomuser.me/api/portraits/women/15.jpg', 'creator', '🌃 ネオン系｜渋谷・原宿ストリート｜サブカル好きあつまれ',              'https://twitter.com/demo15', 'https://instagram.com/demo15', 25, 'approved', '2001-12-30', NOW() - INTERVAL '130 days'),
('10000000-0000-0000-0000-000000000016', 'ran@demo.local',    'ran_gothic',   '神崎 らん',        'https://randomuser.me/api/portraits/women/16.jpg', 'creator', '🖤 ゴシック系｜ダークな世界観｜地雷系・病みかわコンテンツ',            NULL,                          'https://instagram.com/demo16', 30, 'approved', '2000-10-17', NOW() - INTERVAL '210 days'),
('10000000-0000-0000-0000-000000000017', 'tsubasa@demo.local','tsubasa_wing', '鷹山 つばさ',      'https://randomuser.me/api/portraits/women/17.jpg', 'creator', '✨ ダンサー｜ライブ配信経験3年｜元気いっぱいお届けします',             'https://twitter.com/demo17', NULL,                            30, 'approved', '2002-02-08', NOW() - INTERVAL '160 days'),
('10000000-0000-0000-0000-000000000018', 'kiri@demo.local',   'kiri_mint',    '霧島 きり',        'https://randomuser.me/api/portraits/women/18.jpg', 'creator', '🌿 ミントグリーン推し｜ナチュラル系｜すっぴん風メイクが得意',          'https://twitter.com/demo18', 'https://instagram.com/demo18', 28, 'approved', '2003-05-21', NOW() - INTERVAL '60 days'),
('10000000-0000-0000-0000-000000000019', 'reina@demo.local',  'reina_velvet', '江口 れいな',      'https://randomuser.me/api/portraits/women/19.jpg', 'creator', '💎 セレブ風｜ラグジュアリー撮影｜ホテル・ドレスフォト',                NULL,                          'https://instagram.com/demo19', 30, 'approved', '1995-08-14', NOW() - INTERVAL '720 days'),
('10000000-0000-0000-0000-000000000020', 'honoka@demo.local', 'honoka_honey', '星野 ほのか',      'https://randomuser.me/api/portraits/women/20.jpg', 'creator', '🍯 はちみつボイス｜ASMR｜お手紙朗読・癒しボイスメッセージ',            'https://twitter.com/demo20', 'https://instagram.com/demo20', 30, 'pending',  '2001-03-11', NOW() - INTERVAL '7 days');

-- ============================================================
-- 2. 一般ユーザー（ファン）10人
-- ============================================================
INSERT INTO profiles (id, email, username, display_name, avatar_url, role, bio, created_at) VALUES
('20000000-0000-0000-0000-000000000001', 'fan1@demo.local',  'fan_taro',      'たろう',       'https://randomuser.me/api/portraits/men/1.jpg',  'user', '推し活してます',    NOW() - INTERVAL '90 days'),
('20000000-0000-0000-0000-000000000002', 'fan2@demo.local',  'fan_jiro',      'じろう',       'https://randomuser.me/api/portraits/men/2.jpg',  'user', 'ときめきが足りない', NOW() - INTERVAL '60 days'),
('20000000-0000-0000-0000-000000000003', 'fan3@demo.local',  'fan_saburo',    'さぶろう',     'https://randomuser.me/api/portraits/men/3.jpg',  'user', NULL,                NOW() - INTERVAL '120 days'),
('20000000-0000-0000-0000-000000000004', 'fan4@demo.local',  'fan_ken',       'ケン',         'https://randomuser.me/api/portraits/men/4.jpg',  'user', NULL,                NOW() - INTERVAL '200 days'),
('20000000-0000-0000-0000-000000000005', 'fan5@demo.local',  'fan_shou',      'しょう',       'https://randomuser.me/api/portraits/men/5.jpg',  'user', 'コレクター',        NOW() - INTERVAL '30 days'),
('20000000-0000-0000-0000-000000000006', 'fan6@demo.local',  'fan_dai',       'だい',         'https://randomuser.me/api/portraits/men/6.jpg',  'user', NULL,                NOW() - INTERVAL '15 days'),
('20000000-0000-0000-0000-000000000007', 'fan7@demo.local',  'fan_ryu',       'りゅう',       'https://randomuser.me/api/portraits/men/7.jpg',  'user', NULL,                NOW() - INTERVAL '45 days'),
('20000000-0000-0000-0000-000000000008', 'fan8@demo.local',  'fan_hiro',      'ひろ',         'https://randomuser.me/api/portraits/men/8.jpg',  'user', NULL,                NOW() - INTERVAL '180 days'),
('20000000-0000-0000-0000-000000000009', 'fan9@demo.local',  'fan_sho',       'しょう2',      'https://randomuser.me/api/portraits/men/9.jpg',  'user', NULL,                NOW() - INTERVAL '5 days'),
('20000000-0000-0000-0000-000000000010', 'fan10@demo.local', 'fan_kai',       'かい',         'https://randomuser.me/api/portraits/men/10.jpg', 'user', NULL,                NOW() - INTERVAL '365 days');

-- ============================================================
-- 3. コンテンツ（各クリエイター3-4件、計60件）
-- ============================================================
INSERT INTO contents (id, creator_id, title, description, price, content_type, thumbnail_url, file_url, stock_limit, sold_count, is_published, review_status, tags, created_at) VALUES
-- sakura
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '春の制服チェキセット 10枚',               '新入学の季節に撮影した制服チェキ10枚セット。裏面にサイン入り。',     3500, 'image', 'https://picsum.photos/seed/sakura1/600/800', 'dummy/sakura1.jpg', 50, 23, true, 'approved', ARRAY['チェキ','制服','清楚'],            NOW() - INTERVAL '30 days'),
('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '桜並木プライベートフォト',                 '大学のキャンパスで撮影。自然光たっぷり、ふわっと笑顔。',             1800, 'image', 'https://picsum.photos/seed/sakura2/600/800', 'dummy/sakura2.jpg', NULL, 87, true, 'approved', ARRAY['プライベート','屋外','清楚'],      NOW() - INTERVAL '45 days'),
('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'お手紙読み上げ動画（3分）',                 'あなたのお名前を呼びながらお手紙を読みます。名前入力で特別感アップ。', 2500, 'video', 'https://picsum.photos/seed/sakura3/600/800', 'dummy/sakura3.mp4', 20, 12, true, 'approved', ARRAY['動画','メッセージ','カスタム'],    NOW() - INTERVAL '12 days'),
-- yuki
('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'コスプレ第1弾 メイドver',                  'お屋敷のメイドになりきりました。フリル多めで可愛い仕上がり♡',        4200, 'image', 'https://picsum.photos/seed/yuki1/600/800',  'dummy/yuki1.jpg',   100, 56, true, 'approved', ARRAY['コスプレ','メイド'],                NOW() - INTERVAL '60 days'),
('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'グラビア風撮影ムービー',                   '海辺で撮ったムービー。風と太陽と、ちょっとセクシーver。',             5500, 'video', 'https://picsum.photos/seed/yuki2/600/800',  'dummy/yuki2.mp4',   30, 18, true, 'approved', ARRAY['動画','グラビア','水着'],          NOW() - INTERVAL '20 days'),
('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '秘蔵オフショット5枚',                      '撮影の合間に撮ったラフな自撮り。ここでしか見られないリアルなわたし。',1200, 'image', 'https://picsum.photos/seed/yuki3/600/800',  'dummy/yuki3.jpg',   NULL, 145, true, 'approved', ARRAY['オフショット','プライベート'],      NOW() - INTERVAL '8 days'),
-- rina
('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', '制服フォトブック（PDF）20P',               '高校生活最後の制服フォト。誰にも見せてこなかった20ページを特別公開。', 6800, 'image', 'https://picsum.photos/seed/rina1/600/800',  'dummy/rina1.pdf',   NULL, 34, true, 'approved', ARRAY['制服','フォトブック','清楚'],        NOW() - INTERVAL '50 days'),
('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'おはようメッセージ動画',                   '朝、あなたの名前で起こします。30秒の癒し動画。',                       800, 'video', 'https://picsum.photos/seed/rina2/600/800',  'dummy/rina2.mp4',   NULL, 203, true, 'approved', ARRAY['動画','メッセージ','カスタム'],      NOW() - INTERVAL '35 days'),
('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', '放課後チェキ 3枚セット',                   '放課後の教室で撮影。夕日が差す窓辺でちょっとドキドキ。',              2200, 'image', 'https://picsum.photos/seed/rina3/600/800',  'dummy/rina3.jpg',   40, 29, true, 'approved', ARRAY['チェキ','制服'],                     NOW() - INTERVAL '15 days'),
-- mio
('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000004', 'バースデー動画（カスタム）',               '誕生日の朝、あなただけに歌います。名前・年齢お知らせください。',      3800, 'video', 'https://picsum.photos/seed/mio1/600/800',   'dummy/mio1.mp4',   NULL, 67, true, 'approved', ARRAY['動画','バースデー','カスタム'],      NOW() - INTERVAL '22 days'),
('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000004', '笑顔フォトコレクション',                   'わたしの笑顔だけを集めました。元気がほしい日に。',                    1500, 'image', 'https://picsum.photos/seed/mio2/600/800',   'dummy/mio2.jpg',   NULL, 89, true, 'approved', ARRAY['プライベート'],                      NOW() - INTERVAL '40 days'),
-- hana
('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000005', 'プライベートディナーフォト',               '大人のディナー、ドレスアップver。落ち着いた雰囲気で撮りました。',     4500, 'image', 'https://picsum.photos/seed/hana1/600/800',  'dummy/hana1.jpg',  NULL, 41, true, 'approved', ARRAY['大人','ドレス'],                      NOW() - INTERVAL '55 days'),
('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000005', '限定プレミアムムービー',                   '表には出さない、とっておき。18歳以上限定。',                          9800, 'video', 'https://picsum.photos/seed/hana2/600/800',  'dummy/hana2.mp4',  50, 38, true, 'approved', ARRAY['動画','限定','大人'],                  NOW() - INTERVAL '18 days'),
('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000005', 'サイン入りチェキ',                         'マジックでお名前入れます♡世界に1枚だけ。',                            3500, 'image', 'https://picsum.photos/seed/hana3/600/800',  'dummy/hana3.jpg',  30, 19, true, 'approved', ARRAY['チェキ','サイン入り'],                NOW() - INTERVAL '10 days'),
-- aoi
('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000006', 'コスプレ第2弾 制服ver',                    '懐かしの制服、もう一度。放課後気分でいかがですか？',                   3200, 'image', 'https://picsum.photos/seed/aoi1/600/800',   'dummy/aoi1.jpg',   80, 52, true, 'approved', ARRAY['コスプレ','制服'],                     NOW() - INTERVAL '25 days'),
('30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000006', '月替わりコスプレ動画（4月）',              '今月のテーマは「保健室の先生」。',                                     4800, 'video', 'https://picsum.photos/seed/aoi2/600/800',   'dummy/aoi2.mp4',   NULL, 73, true, 'approved', ARRAY['動画','コスプレ'],                     NOW() - INTERVAL '5 days'),
-- moe
('30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000007', 'ダンス動画（アイドル曲）',                 '大好きなアイドル曲を踊ってみた。フル尺2分。',                         2800, 'video', 'https://picsum.photos/seed/moe1/600/800',   'dummy/moe1.mp4',   NULL, 112, true, 'approved', ARRAY['動画','ダンス','アイドル'],            NOW() - INTERVAL '14 days'),
('30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000007', 'アイドル衣装フォトセット',                 'ステージ衣装で撮影した10枚セット。',                                   3500, 'image', 'https://picsum.photos/seed/moe2/600/800',   'dummy/moe2.jpg',   60, 48, true, 'approved', ARRAY['アイドル','衣装'],                    NOW() - INTERVAL '32 days'),
-- nana
('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000008', 'ランジェリー撮影ムービー（18+）',          '18歳以上限定。落ち着いたホテルで撮影した上品なムービー。',            12800, 'video', 'https://picsum.photos/seed/nana1/600/800', 'dummy/nana1.mp4', 30, 21, true, 'approved', ARRAY['動画','大人','限定'],                  NOW() - INTERVAL '11 days'),
('30000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000008', 'プレミアムフォトブック（PDF 30P）',        '大人の雰囲気たっぷりの30ページ。',                                    8800, 'image', 'https://picsum.photos/seed/nana2/600/800', 'dummy/nana2.pdf', NULL, 34, true, 'approved', ARRAY['フォトブック','大人'],                NOW() - INTERVAL '28 days'),
-- kana
('30000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000009', 'スポーツユニフォームフォト',               'バスケユニフォームで撮影。汗かき系女子です。',                         2400, 'image', 'https://picsum.photos/seed/kana1/600/800', 'dummy/kana1.jpg',   NULL, 63, true, 'approved', ARRAY['スポーツ','ユニフォーム'],             NOW() - INTERVAL '16 days'),
('30000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000009', 'カジュアル私服フォトセット',               '普段の私服でナチュラルな1日を撮影。',                                  1800, 'image', 'https://picsum.photos/seed/kana2/600/800', 'dummy/kana2.jpg',   NULL, 94, true, 'approved', ARRAY['プライベート','私服'],                NOW() - INTERVAL '70 days'),
-- emi
('30000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000010', 'カフェデートフォト',                       '都内のおしゃれカフェ巡り。彼女気分で一緒に。',                        2800, 'image', 'https://picsum.photos/seed/emi1/600/800',  'dummy/emi1.jpg',   NULL, 78, true, 'approved', ARRAY['デート','カフェ','プライベート'],      NOW() - INTERVAL '42 days'),
('30000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000010', '癒しメッセージ動画',                       'お疲れの日に見てほしい、優しい声で話します。',                         1500, 'video', 'https://picsum.photos/seed/emi2/600/800',  'dummy/emi2.mp4',   NULL, 156, true, 'approved', ARRAY['動画','メッセージ','癒し'],            NOW() - INTERVAL '19 days'),
-- mei
('30000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000011', 'ピンクの部屋で撮影',                       '自宅のピンクの部屋でプライベートショット。',                          3200, 'image', 'https://picsum.photos/seed/mei1/600/800',  'dummy/mei1.jpg',   NULL, 87, true, 'approved', ARRAY['プライベート','ピンク'],               NOW() - INTERVAL '38 days'),
('30000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000011', 'サイン入りチェキ（個別メッセージ付）',      'お名前入りメッセージ付きの世界で1枚のチェキ。',                       3800, 'image', 'https://picsum.photos/seed/mei2/600/800',  'dummy/mei2.jpg',   40, 31, true, 'approved', ARRAY['チェキ','サイン入り','カスタム'],     NOW() - INTERVAL '3 days'),
-- miku
('30000000-0000-0000-0000-000000000027', '10000000-0000-0000-0000-000000000012', 'モノクロアートフォト',                     '全編モノクロ、アーティスティックな表現。',                             3500, 'image', 'https://picsum.photos/seed/miku1/600/800', 'dummy/miku1.jpg',  NULL, 42, true, 'approved', ARRAY['アート','モノクロ'],                   NOW() - INTERVAL '24 days'),
('30000000-0000-0000-0000-000000000028', '10000000-0000-0000-0000-000000000012', 'クールな冬のコレクション',                 '雪景色の中で撮った、ちょっと切ない冬ver。',                           2800, 'image', 'https://picsum.photos/seed/miku2/600/800', 'dummy/miku2.jpg',  NULL, 56, true, 'approved', ARRAY['季節','冬'],                           NOW() - INTERVAL '80 days'),
-- yui
('30000000-0000-0000-0000-000000000029', '10000000-0000-0000-0000-000000000013', '浴衣フォトセット（夏祭り）',               '夏祭りで撮った浴衣姿。髪に花飾り。',                                   3400, 'image', 'https://picsum.photos/seed/yui1/600/800',  'dummy/yui1.jpg',   NULL, 71, true, 'approved', ARRAY['和装','浴衣','季節'],                  NOW() - INTERVAL '130 days'),
('30000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000013', '着物お正月フォト',                         '新年の着物姿。神社で撮影。',                                           3800, 'image', 'https://picsum.photos/seed/yui2/600/800',  'dummy/yui2.jpg',   NULL, 85, true, 'approved', ARRAY['和装','着物','季節'],                  NOW() - INTERVAL '110 days'),
-- ami
('30000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000014', '夏の水着グラビア',                         '南国ビーチで撮ったグラビア風水着フォト。',                             5800, 'image', 'https://picsum.photos/seed/ami1/600/800',  'dummy/ami1.jpg',   NULL, 102, true, 'approved', ARRAY['水着','グラビア','夏'],                NOW() - INTERVAL '95 days'),
('30000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000014', 'ビーチで遊ぶ動画',                         'わいわい遊んだ1日をそのまま動画に。',                                 4200, 'video', 'https://picsum.photos/seed/ami2/600/800',  'dummy/ami2.mp4',  NULL, 68, true, 'approved', ARRAY['動画','夏','ビーチ'],                  NOW() - INTERVAL '70 days'),
-- lisa
('30000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000015', '渋谷ネオンストリート撮影',                 '夜の渋谷で撮ったストリート感ある1枚。',                               2600, 'image', 'https://picsum.photos/seed/lisa1/600/800', 'dummy/lisa1.jpg',   NULL, 59, true, 'approved', ARRAY['ストリート','夜景','サブカル'],       NOW() - INTERVAL '26 days'),
('30000000-0000-0000-0000-000000000034', '10000000-0000-0000-0000-000000000015', '原宿ファッションフォト',                   '派手派手な原宿ファッションでキメました。',                             2400, 'image', 'https://picsum.photos/seed/lisa2/600/800', 'dummy/lisa2.jpg',   NULL, 48, true, 'approved', ARRAY['ファッション','原宿'],                 NOW() - INTERVAL '48 days'),
-- ran
('30000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000016', 'ゴシックロリータコレクション',             '黒×レースの世界観。',                                                  4500, 'image', 'https://picsum.photos/seed/ran1/600/800',  'dummy/ran1.jpg',   50, 33, true, 'approved', ARRAY['ゴシック','ロリータ'],                 NOW() - INTERVAL '20 days'),
('30000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000016', '地雷系自撮りフォト',                       '病みかわ風の地雷系メイク＆ファッション。',                             2200, 'image', 'https://picsum.photos/seed/ran2/600/800',  'dummy/ran2.jpg',   NULL, 76, true, 'approved', ARRAY['地雷系','サブカル'],                   NOW() - INTERVAL '62 days'),
-- tsubasa
('30000000-0000-0000-0000-000000000037', '10000000-0000-0000-0000-000000000017', 'ダンスパフォーマンス動画',                 'キレキレダンスを撮影。完全版5分！',                                    3500, 'video', 'https://picsum.photos/seed/tsubasa1/600/800','dummy/tsubasa1.mp4', NULL, 94, true, 'approved', ARRAY['動画','ダンス'],                     NOW() - INTERVAL '9 days'),
('30000000-0000-0000-0000-000000000038', '10000000-0000-0000-0000-000000000017', 'ライブ衣装フォト',                         'パフォーマンス衣装20枚一気見せ。',                                     2900, 'image', 'https://picsum.photos/seed/tsubasa2/600/800','dummy/tsubasa2.jpg', NULL, 65, true, 'approved', ARRAY['ライブ','衣装'],                      NOW() - INTERVAL '54 days'),
-- kiri
('30000000-0000-0000-0000-000000000039', '10000000-0000-0000-0000-000000000018', 'すっぴん風ナチュラルフォト',               'メイク薄めの自然体。',                                                 1800, 'image', 'https://picsum.photos/seed/kiri1/600/800', 'dummy/kiri1.jpg',   NULL, 58, true, 'approved', ARRAY['ナチュラル','プライベート'],           NOW() - INTERVAL '13 days'),
('30000000-0000-0000-0000-000000000040', '10000000-0000-0000-0000-000000000018', 'カフェ日記動画',                           'お気に入りのカフェを案内するVlog。',                                   2200, 'video', 'https://picsum.photos/seed/kiri2/600/800', 'dummy/kiri2.mp4',  NULL, 41, true, 'approved', ARRAY['動画','Vlog','カフェ'],                NOW() - INTERVAL '36 days'),
-- reina
('30000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000019', 'ホテルドレスフォト',                       '高級ホテルでドレス撮影。セレブ気分をどうぞ。',                        6800, 'image', 'https://picsum.photos/seed/reina1/600/800', 'dummy/reina1.jpg', NULL, 45, true, 'approved', ARRAY['ドレス','ホテル','ラグジュアリー'],    NOW() - INTERVAL '40 days'),
('30000000-0000-0000-0000-000000000042', '10000000-0000-0000-0000-000000000019', 'ラグジュアリームービー',                   'プライベートジェット風の世界観。',                                     9500, 'video', 'https://picsum.photos/seed/reina2/600/800', 'dummy/reina2.mp4', 30, 22, true, 'approved', ARRAY['動画','ラグジュアリー'],               NOW() - INTERVAL '15 days'),
-- honoka（pending）
('30000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000020', '癒しボイスメッセージ',                      'あなたのお名前を甘い声で呼びます。',                                   1500, 'video', 'https://picsum.photos/seed/honoka1/600/800','dummy/honoka1.mp4', NULL, 0, false, 'pending', ARRAY['ASMR','ボイス','カスタム'],            NOW() - INTERVAL '2 days'),
-- 未審査・却下サンプル
('30000000-0000-0000-0000-000000000044', '10000000-0000-0000-0000-000000000001', '新作チェキ販売（審査待ち）',               '最新作。審査お願いします。',                                           2800, 'image', 'https://picsum.photos/seed/sakura4/600/800', 'dummy/sakura4.jpg', 30, 0, false, 'pending', ARRAY['チェキ','新作'],                       NOW() - INTERVAL '1 days'),
('30000000-0000-0000-0000-000000000045', '10000000-0000-0000-0000-000000000007', 'テスト動画',                               '内容少なすぎて却下されました。',                                       500, 'video',  'https://picsum.photos/seed/moe3/600/800',    'dummy/moe3.mp4',    NULL, 0, false, 'rejected', ARRAY['テスト'],                             NOW() - INTERVAL '5 days');

-- ============================================================
-- 4. フォロー関係
-- ============================================================
INSERT INTO follows (follower_id, creator_id) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003'),
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000014'),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000008'),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000007'),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000017'),
('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003'),
('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000013'),
('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000005'),
('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008'),
('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000019');

-- ============================================================
-- 5. 購入履歴（チップ含む）
-- ============================================================
INSERT INTO purchases (user_id, content_id, amount, content_price, tip_amount, stripe_payment_intent_id, status, delivery_status, delivered_at, created_at) VALUES
('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 3500, 3500, 0,   'pi_demo_001', 'completed', 'delivered', NOW() - INTERVAL '29 days', NOW() - INTERVAL '30 days'),
('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 2800, 1800, 1000,'pi_demo_002', 'completed', 'delivered', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', 2200, 2200, 0,   'pi_demo_003', 'completed', 'delivered', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 4200, 4200, 0,   'pi_demo_004', 'completed', 'delivered', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),
('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', 1700, 1200, 500, 'pi_demo_005', 'completed', 'delivered', NOW() - INTERVAL '7 days',  NOW() - INTERVAL '7 days'),
('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000015', 3200, 3200, 0,   'pi_demo_006', 'completed', 'delivered', NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days'),
('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000025', 3700, 3200, 500, 'pi_demo_007', 'completed', 'delivered', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),
('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 5500, 3500, 2000,'pi_demo_008', 'completed', 'delivered', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),
('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000031', 5800, 5800, 0,   'pi_demo_009', 'completed', 'delivered', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000019', 12800,12800, 0,  'pi_demo_010', 'completed', 'delivered', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000013', 9800, 9800, 0,   'pi_demo_011', 'completed', 'delivered', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000017', 2800, 2800, 0,   'pi_demo_012', 'completed', 'delivered', NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000037', 4500, 3500, 1000,'pi_demo_013', 'completed', 'delivered', NOW() - INTERVAL '8 days',  NOW() - INTERVAL '8 days'),
('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000008', 800,  800,  0,   'pi_demo_014', 'completed', 'delivered', NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 days'),
('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007', 6800, 6800, 0,   'pi_demo_015', 'completed', 'pending',  NULL,                         NOW() - INTERVAL '1 days'),
('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000029', 3400, 3400, 0,   'pi_demo_016', 'completed', 'delivered', NOW() - INTERVAL '42 days', NOW() - INTERVAL '42 days'),
('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000004', 5200, 4200, 1000,'pi_demo_017', 'completed', 'delivered', NOW() - INTERVAL '51 days', NOW() - INTERVAL '52 days'),
('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000012', 4500, 4500, 0,   'pi_demo_018', 'completed', 'delivered', NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),
('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000019', 15800,12800,3000,'pi_demo_019', 'completed', 'delivered', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('20000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', 3000, 2500, 500, 'pi_demo_020', 'completed', 'pending',  NULL,                         NOW() - INTERVAL '2 days'),
('20000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000041', 7800, 6800, 1000,'pi_demo_021', 'completed', 'delivered', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('20000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000042', 9500, 9500, 0,   'pi_demo_022', 'completed', 'delivered', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- ============================================================
-- 6. レビュー
-- ============================================================
INSERT INTO reviews (content_id, user_id, rating, comment, created_at) VALUES
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 5, '可愛すぎて毎日見てます！また買います！',                           NOW() - INTERVAL '27 days'),
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 5, 'サインありがとうございました。大切にします。',                       NOW() - INTERVAL '26 days'),
('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 4, '春らしい雰囲気が最高。もっと枚数欲しかったかな。',                   NOW() - INTERVAL '38 days'),
('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 5, 'メイドさん最高です！第2弾も期待してます！！',                       NOW() - INTERVAL '49 days'),
('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000008', 5, 'フリルの再現度すごい。写真のクオリティも文句なし。',                 NOW() - INTERVAL '51 days'),
('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 5, 'この値段でこのクオリティはコスパ良すぎ',                             NOW() - INTERVAL '6 days'),
('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000006', 5, '20Pのボリューム感すごい！永久保存します',                            NOW() - INTERVAL '12 hours'),
('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000006', 5, '朝起きるのが楽しみになりました。癒されます。',                       NOW() - INTERVAL '2 days'),
('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000004', 5, '期待通りの限定感。大人の雰囲気すごい。',                             NOW() - INTERVAL '16 days'),
('30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000002', 4, '制服好きにはたまらない。もっとアップがあれば完璧だった。',           NOW() - INTERVAL '19 days'),
('30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000005', 5, 'キレキレのダンスが最高！もっと動画ください！',                       NOW() - INTERVAL '12 days'),
('30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000004', 5, 'プレミアム感が半端ない。この値段の価値は十分あります。',             NOW() - INTERVAL '9 days'),
('30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000008', 5, '上品さが出てて大満足。',                                             NOW() - INTERVAL '9 days'),
('30000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000003', 5, 'グラビア感抜群！夏にぴったり',                                       NOW() - INTERVAL '89 days'),
('30000000-0000-0000-0000-000000000037', '20000000-0000-0000-0000-000000000005', 5, 'つばさちゃんのダンス可愛すぎる〜！',                                 NOW() - INTERVAL '7 days'),
('30000000-0000-0000-0000-000000000041', '20000000-0000-0000-0000-000000000010', 5, 'ゴージャス！れいなさんの表情が最高です',                             NOW() - INTERVAL '29 days'),
('30000000-0000-0000-0000-000000000042', '20000000-0000-0000-0000-000000000010', 5, '動画の雰囲気めっちゃ好き。また買います。',                           NOW() - INTERVAL '13 days'),
('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000009', 5, '名前呼んでもらえたの感動しました',                                   NOW() - INTERVAL '1 days');

-- ============================================================
-- 7. 販売リクエスト
-- ============================================================
INSERT INTO requests (user_id, creator_id, message, budget, status, creator_reply, created_at) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '誕生日メッセージ動画を1本お願いしたいです。名前は「たろう」です。', 5000, 'pending', NULL, NOW() - INTERVAL '3 days'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'アイドル曲「青春コール」のダンス動画をリクエストしたいです。',     8000, 'accepted', '喜んでお受けします！来週中に納品予定です🎀', NOW() - INTERVAL '10 days'),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000011', 'ピンクのフリル衣装でお写真撮影お願いしたいです。',                 10000,'pending', NULL, NOW() - INTERVAL '1 days'),
('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000005', '特別コンテンツの個別撮影希望です。DMでもやり取りできますか？',     30000,'completed', 'ありがとうございました！また機会があればぜひ', NOW() - INTERVAL '45 days');

-- ============================================================
-- 8. 特集バナー
-- ============================================================
INSERT INTO featured_banners (title, subtitle, creator_id, content_id, image_url, link_url, sort_order, is_active) VALUES
('DEMO: 今月の注目クリエイター',           '新人ながら人気急上昇中のりなちゃん',     '10000000-0000-0000-0000-000000000003', NULL,                                    'https://picsum.photos/seed/banner1/1200/400', '/creator/rina_sugar',    1, true),
('DEMO: 春の新作フォトコレクション',       '桜シーズン限定のチェキセット',           '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',  'https://picsum.photos/seed/banner2/1200/400', '/contents/30000000-0000-0000-0000-000000000001', 2, true),
('DEMO: プレミアムムービー特集',           '大人向けの上質コンテンツ',                '10000000-0000-0000-0000-000000000008', NULL,                                   'https://picsum.photos/seed/banner3/1200/400', '/creator/nana_luna',     3, true),
('DEMO: 夏のグラビアフェア',               '水着・ビーチフォト今だけ10%OFF',         '10000000-0000-0000-0000-000000000014', NULL,                                   'https://picsum.photos/seed/banner4/1200/400', '/creator/ami_coral',     4, true),
('DEMO: 推し診断で運命のクリエイターを',   '5つの質問で、あなたにぴったりの推しを',  NULL,                                   NULL,                                    'https://picsum.photos/seed/banner5/1200/400', '/diagnosis',             5, true);

-- ============================================================
-- 9. sold_count を purchases から再計算
-- ============================================================
UPDATE contents SET sold_count = (
  SELECT COUNT(*) FROM purchases WHERE purchases.content_id = contents.id AND status = 'completed'
) WHERE creator_id::text LIKE '1%';

-- FK制約を再有効化
SET session_replication_role = DEFAULT;

-- ============================================================
-- 確認
-- ============================================================
SELECT 'creators' AS table_name, COUNT(*) AS count FROM profiles WHERE role = 'creator' AND id::text LIKE '1%'
UNION ALL SELECT 'users',    COUNT(*) FROM profiles    WHERE role = 'user'    AND id::text LIKE '2%'
UNION ALL SELECT 'contents', COUNT(*) FROM contents    WHERE creator_id::text LIKE '1%'
UNION ALL SELECT 'purchases',COUNT(*) FROM purchases   WHERE user_id::text LIKE '2%'
UNION ALL SELECT 'reviews',  COUNT(*) FROM reviews     WHERE user_id::text LIKE '2%'
UNION ALL SELECT 'follows',  COUNT(*) FROM follows     WHERE creator_id::text LIKE '1%'
UNION ALL SELECT 'banners',  COUNT(*) FROM featured_banners WHERE title LIKE 'DEMO:%';
