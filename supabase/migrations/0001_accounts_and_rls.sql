-- Macronaut accounts: profile rows owned by exactly one auth user.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) before the app
-- signs anyone in. Two rules hold the security model together:
--
--   1. Row Level Security is enabled on every table that holds user data, and
--      the only rows a request can touch are the ones whose owner column
--      equals the caller's auth.uid(). The app never filters by user id for
--      security; the database refuses the rows either way.
--   2. `anon` gets no access to user data at all. The publishable key shipped
--      in the app bundle authenticates as `anon` until a user signs in, so
--      anything `anon` can read is effectively public.

-- Web/mobile clients reach tables through the Data API as `anon` (signed out)
-- or `authenticated` (signed in). They need schema usage, nothing more.
grant usage on schema public to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit_system text not null default 'us',
  week_start text not null default 'monday',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_len check (
    display_name is null or char_length(display_name) <= 60
  ),
  constraint profiles_unit_system_valid check (unit_system in ('us', 'metric')),
  constraint profiles_week_start_valid check (week_start in ('sunday', 'monday'))
);

comment on table public.profiles is
  'One row per auth user. Readable and writable only by that user.';

alter table public.profiles enable row level security;
-- Table owners bypass RLS by default; forcing it removes that exemption so a
-- future migration running as the owner cannot silently read every row.
alter table public.profiles force row level security;

-- Column privileges are the second half of the model: RLS decides which rows,
-- grants decide which columns and verbs. `id` is deliberately not updatable,
-- so a user cannot re-parent their row onto another account.
revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name, unit_system, week_start) on public.profiles to authenticated;

-- auth.uid() is wrapped in a subquery so Postgres evaluates it once per
-- statement instead of once per row.
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy: accounts are removed through auth.users, and the cascade
-- above takes the profile with them.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
-- Empty search_path: a security definer function that resolves unqualified
-- names through the caller's search_path can be hijacked.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Provision the profile server-side. Doing it here rather than from the client
-- means a signed-in user cannot skip it or create rows for anyone else.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(
      left(
        trim(
          coalesce(
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name',
            ''
          )
        ),
        60
      ),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Template for the sync tables that cloud sync will add (diary_entries,
-- custom_foods, goal_configs, …). Copy this shape for each one so isolation is
-- part of the table definition rather than something to remember later:
--
--   create table public.<name> (
--     id uuid primary key default gen_random_uuid(),
--     user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
--     ...
--   );
--   create index on public.<name> (user_id);   -- policies filter on it
--   alter table public.<name> enable row level security;
--   alter table public.<name> force row level security;
--   revoke all on public.<name> from anon, authenticated;
--   grant select, insert, update, delete on public.<name> to authenticated;
--   create policy "<name>: own rows" on public.<name>
--     for all to authenticated
--     using (user_id = (select auth.uid()))
--     with check (user_id = (select auth.uid()));
