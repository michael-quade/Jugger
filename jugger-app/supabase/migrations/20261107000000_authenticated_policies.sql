-- Juggerknocker Invitational: give signed-in users the same access anon has today.
-- Run after 20261106000000_profiles.sql. Existing anon policies stay in place until
-- every device has the login-gated app; they're dropped in a later lockdown step.

-- ── Tables ───────────────────────────────────────────────────────────────────

create policy "signed_in_all" on public.app_state    for all to authenticated using (true) with check (true);
create policy "signed_in_all" on public.matches      for all to authenticated using (true) with check (true);
create policy "signed_in_all" on public.team_scores  for all to authenticated using (true) with check (true);
create policy "signed_in_all" on public.mb_threads   for all to authenticated using (true) with check (true);
create policy "signed_in_all" on public.mb_posts     for all to authenticated using (true) with check (true);
create policy "signed_in_all" on public.mb_reactions for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.mb_posts to authenticated;

-- ── Storage buckets (board photos, file archive) ─────────────────────────────

create policy "signed_in_all_jugger_board" on storage.objects
  for all to authenticated
  using (bucket_id = 'jugger-board') with check (bucket_id = 'jugger-board');

create policy "signed_in_all_jugger_archive" on storage.objects
  for all to authenticated
  using (bucket_id = 'jugger-archive') with check (bucket_id = 'jugger-archive');
