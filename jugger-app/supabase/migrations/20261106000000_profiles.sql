-- Juggerknocker Invitational: Supabase Auth migration
-- Adds profiles table, role management, and gating for all existing tables.
-- Run once in Supabase → SQL Editor → New query.

-- ── 1. profiles table ────────────────────────────────────────────────────────

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  username       text not null unique,
  display_name   text,
  role           text not null default 'player'
                   check (role in ('admin', 'scorer', 'player', 'treasurer')),
  can_score      boolean not null default false,
  can_treasure   boolean not null default false,
  player_id      text,       -- links to Player.id in Zustand roster
  is_sub_account boolean not null default false,
  created_at     timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users account; holds role + permissions.';

alter table public.profiles enable row level security;

-- ── 2. is_jugger_admin() helper ──────────────────────────────────────────────
-- security definer so it runs as the function owner (postgres), not the caller.
-- Using set search_path = '' prevents search_path injection.

create function public.is_jugger_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ── 3. handle_new_user() trigger ─────────────────────────────────────────────
-- Auto-creates a profiles row when a user is added to auth.users.
-- Role, display_name, and other fields come from raw_user_meta_data,
-- set by the Edge Function when creating users.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username    text;
  v_display_name text;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  -- Ensure uniqueness with a short id suffix on collision
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || '_' || substr(new.id::text, 1, 4);
  end if;

  insert into public.profiles (
    id, email, username, display_name, role,
    can_score, can_treasure, player_id, is_sub_account
  ) values (
    new.id,
    new.email,
    v_username,
    v_display_name,
    coalesce(new.raw_user_meta_data->>'role', 'player'),
    coalesce((new.raw_user_meta_data->>'can_score')::boolean, false),
    coalesce((new.raw_user_meta_data->>'can_treasure')::boolean, false),
    new.raw_user_meta_data->>'player_id',
    coalesce((new.raw_user_meta_data->>'is_sub_account')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 4. RLS policies on profiles ──────────────────────────────────────────────

-- Any signed-in user can read all profiles (admin panel needs the full list)
create policy "Signed-in users read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- No self-update policy: RLS is row-level, so one would let a player change
-- their own role column. Only admins edit profiles.

-- Admins can update any profile (role changes, scorer/treasurer toggles)
create policy "Admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_jugger_admin());

-- Profiles are created only via the trigger (no direct insert from client)
-- No insert policy needed.

-- Admins can delete profiles (the Edge Function deletes from auth.users first,
-- which cascades to profiles, so this policy is a safety belt)
create policy "Admins delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_jugger_admin());

-- ── 5. Grants for authenticated on existing tournament tables ─────────────────
-- Before auth gate: requests used anon key → anon role.
-- After auth gate:  requests carry session JWT → authenticated role.
-- Both roles need full access to the three sync tables.

grant select, insert, update, delete on public.app_state     to anon, authenticated;
grant select, insert, update, delete on public.matches       to anon, authenticated;
grant select, insert, update, delete on public.team_scores   to anon, authenticated;

-- If the message board tables exist, grant authenticated too.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mb_threads') then
    execute 'grant select, insert, update, delete on public.mb_threads to authenticated';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mb_replies') then
    execute 'grant select, insert, update, delete on public.mb_replies to authenticated';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mb_reactions') then
    execute 'grant select, insert, update, delete on public.mb_reactions to authenticated';
  end if;
end;
$$;

-- ── 6. Ping function (keeps free-tier project alive) ─────────────────────────

create or replace function public.ping()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'pong';
$$;

grant execute on function public.ping() to anon, authenticated;

-- ── AFTER RUNNING THIS MIGRATION ─────────────────────────────────────────────
-- 1. In Supabase Auth settings, disable "Allow new users to sign up".
-- 2. In Supabase Auth email settings, enable "OTP" (magic link) if not already.
-- 3. Create the first admin user:
--      Supabase Dashboard → Authentication → Users → Add user → Create new user
--      (enter your email, any password, check "Auto Confirm User")
--      Then run in SQL Editor:
--        update public.profiles set role = 'admin' where email = 'your@email.com';
-- 4. Deploy the admin-users Edge Function:
--      supabase functions deploy admin-users
-- ─────────────────────────────────────────────────────────────────────────────
