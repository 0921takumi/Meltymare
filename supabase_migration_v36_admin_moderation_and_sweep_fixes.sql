-- ============================================================
-- v36: 「エージェント総出」総点検で見つかった7件の修正
--
-- 🔴🔴🔴 最重要・実地確認済み: 管理者のコンテンツ承認/却下が機能不全だった
--   v31 で contents_update に role チェックを追加した際、同じファイル内の
--   coupons_manage には存在する「管理者はcreator_id不一致でも操作可」の
--   admin OR分岐を、contents_update にだけ入れ忘れていた。
--
--   結果: using/with check が両方とも
--     creator_id = auth.uid() and role in ('creator','admin')
--   のみとなり、管理者が「自分が作成者ではない」通常のクリエイターの投稿を
--   承認/却下/非公開化しようとすると、RLSに阻まれて0行更新になる。
--   app/admin/contents/actions.ts の update() は .select() を付けていないため
--   0行更新でもSupabaseはエラーを返さず、「更新成功」の画面のまま実際には
--   review_status/is_published が一切変わらない、という完全なサイレント故障だった。
--
--   実地攻撃(ではなく実地機能テスト)で確認済み:
--     admin.demo@my-focus.jp で creator.demo@my-focus.jp 名義のpendingコンテンツを
--     承認しようとしたところ、エラー無し・0行更新・DB値は pending/false のまま。
--
--   影響: 移籍予定クリエイターを含む「自分以外」の投稿を管理者が一切審査できない
--   状態。今回の一連の修正の中でも最優先で直すべき機能崩壊。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

-- ── ① contents_update: coupons_manage と同じ admin OR 分岐を追加 ──
drop policy if exists "contents_update" on public.contents;
create policy "contents_update" on public.contents
  for update
  using (
    (creator_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin')))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    (creator_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin')))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 確認(必須):
--   admin.demo で他人(creator.demo)名義のpendingコンテンツを承認 → review_status が
--   実際に approved に変わること（アプリの管理画面 /admin/contents から再確認推奨）。

-- ============================================================
-- ② audit_logs: 「admin.*」名義の監査ログを非adminが自分になりすまして
--   捏造できてしまう穴を塞ぐ。actor_id=auth.uid()のみのチェックで、action文字列
--   自体には制約が無かった。実害は現状「表示UIが無い」ため限定的だが、将来の
--   インシデント調査でこのテーブルを信頼した際に偽の管理者操作記録が
--   紛れ込むリスクがあるため今回まとめて塞ぐ。
-- ============================================================
drop policy if exists "audit_logs_insert_self" on public.audit_logs;
create policy "audit_logs_insert_self" on public.audit_logs for insert with check (
  actor_id = auth.uid()
  and (
    action not like 'admin.%'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
);

-- ============================================================
-- ③ reviews_update: v33でreviews_insertに追加した「購入済みチェック」が
--   updateには反映されておらず、
--     - 返金されて購入が完了状態でなくなった後もレビューを編集し続けられる
--     - WITH CHECK が無い(USINGの使い回し)ため、content_id を書き換えて
--       「本当は買っていない別コンテンツ」にレビューを付け替えられる
--   の2つの穴があった。insert と同じ購入済み条件を using/with check 両方に追加。
-- ============================================================
drop policy if exists "reviews_update" on public.reviews;
create policy "reviews_update" on public.reviews
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.purchases p
      where p.user_id = auth.uid() and p.content_id = reviews.content_id and p.status = 'completed'
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.purchases p
      where p.user_id = auth.uid() and p.content_id = reviews.content_id and p.status = 'completed'
    )
  );

-- ============================================================
-- ④ birthday_messages: app/api/birthday-message/route.ts はAPI層で
--   「自分宛送信禁止」「creator_id が実在しrole='creator'」「accepts_birthday_messages」
--   「birthdate設定済み」を検証しているが、実際のinsertはservice_roleではなく
--   ユーザーセッションクライアントで行われており、これも今回一貫して見つかっている
--   「APIの業務ルールがRLSに反映されていない」パターン。直接
--   supabase.from('birthday_messages').insert(...) を呼べば、自分宛・受付停止中の
--   クリエイター宛・クリエイターですらない相手宛にメッセージを捏造できた。
--   （表示UIが未実装のためXSS等の実害は現状無いが、書き込み側の整合性として塞ぐ）
-- ============================================================
drop policy if exists "bday_insert" on public.birthday_messages;
create policy "bday_insert" on public.birthday_messages
  for insert
  with check (
    auth.uid() = user_id
    and user_id <> creator_id
    and exists (
      select 1 from public.profiles p
      where p.id = birthday_messages.creator_id
        and p.role = 'creator'
        and p.accepts_birthday_messages = true
        and p.birthdate is not null
    )
  );

-- ============================================================
-- ⑤ sold_count の返金デクリメントをアトミック化
--   app/api/webhook/route.ts の handleChargeRefunded が read-then-write で
--   sold_count を1減算しており、ごく低頻度とはいえ並行返金でロストアップデートが
--   起こり得た。increment_sold_count と対になる decrement_sold_count RPC を追加し、
--   webhook側もRPC経由に切り替える（コード側は別途修正）。
-- ============================================================
drop function if exists public.decrement_sold_count(uuid);
create function public.decrement_sold_count(content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contents
    set sold_count = greatest(coalesce(sold_count, 0) - 1, 0)
    where id = content_id;
end;
$$;

revoke execute on function public.decrement_sold_count(uuid) from public, anon, authenticated;
grant execute on function public.decrement_sold_count(uuid) to service_role;

-- 確認(任意):
--   role='user' の実セッションで rpc('decrement_sold_count', {...}) を呼ぶと
--   permission denied for function になること（webhookはservice_roleなので影響なし）。
-- ============================================================
