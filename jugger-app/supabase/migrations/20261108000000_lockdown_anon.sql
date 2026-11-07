-- Juggerknocker Invitational: remove anonymous access. Only signed-in golfers
-- (authenticated role, covered by the signed_in_all policies) can read or write.
-- Run after 20261107000000_authenticated_policies.sql.
--
-- PREVIEW first — these are the policies the block below drops:
--   select schemaname, tablename, policyname, roles, cmd
--   from pg_policies
--   where (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
--     and roles && array['anon', 'public']::name[];

-- ── 1. Drop every policy that lets anon (directly or via the public role) in ──

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
      and roles && array['anon', 'public']::name[]
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- ── 2. Remove anon's table privileges (belt and braces alongside RLS) ────────

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ── 3. Make sure RLS is on everywhere, so a table with RLS off isn't left open ─

alter table public.app_state    enable row level security;
alter table public.matches      enable row level security;
alter table public.team_scores  enable row level security;
alter table public.mb_threads   enable row level security;
alter table public.mb_posts     enable row level security;
alter table public.mb_reactions enable row level security;
alter table public.profiles     enable row level security;

-- ping() stays executable by anon for the weekly keep-alive job.

-- ── ROLLBACK (only if something breaks and you need the old open access back) ─
--   grant select, insert, update, delete on public.app_state, public.matches,
--     public.team_scores, public.mb_threads, public.mb_posts, public.mb_reactions to anon;
--   create policy "anon_all" on public.app_state    for all to anon using (true) with check (true);
--   create policy "anon_all" on public.matches      for all to anon using (true) with check (true);
--   create policy "anon_all" on public.team_scores  for all to anon using (true) with check (true);
--   create policy "anon_all" on public.mb_threads   for all to anon using (true) with check (true);
--   create policy "anon_all" on public.mb_posts     for all to anon using (true) with check (true);
--   create policy "anon_all" on public.mb_reactions for all to anon using (true) with check (true);
