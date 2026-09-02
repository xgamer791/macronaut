-- Macronaut · cloud mirror of the on-device diary
--
-- Run this in the Supabase SQL editor after 0001_accounts_and_rls.sql. It is
-- idempotent: re-running it is safe and changes nothing.
--
-- Every table below mirrors a local SQLite table one-for-one, with three
-- additions:
--   user_id    the owner; defaulted from auth.uid() and pinned by a trigger so
--              a client cannot write a row into someone else's account
--   _deleted   tombstone. A row deleted on one device is kept here as a marker
--              so other devices learn about the deletion instead of resurrecting
--              the row on their next push. Distinct from the domain-level
--              `deleted` column that a few tables carry for their own soft delete.
--   _synced_at server clock, stamped on every write. This is the pull cursor:
--              a client asks for rows newer than the last value it saw.
--
-- Types follow SQLite: TEXT -> text, REAL -> double precision, INTEGER flags
-- stay integer so 0/1 round-trips exactly rather than through a boolean cast.
--
-- Row Level Security is the only thing standing between one account's food
-- diary and another's, so it is enabled AND forced on every table, and the
-- policy is the same everywhere: you touch rows where user_id = auth.uid().

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "key" text not null,
  "value" text,
  primary key (user_id, "key")
);

create table if not exists public.goal_configs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "effective_from" text,
  "created_at" text,
  "payload" text,
  primary key (user_id, "id")
);

create table if not exists public.day_type_marks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "date" text not null,
  "day_type" text,
  primary key (user_id, "date")
);

create table if not exists public.meal_categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "name" text,
  "position" integer,
  "builtin" integer,
  "deleted" integer,
  primary key (user_id, "id")
);

create table if not exists public.custom_foods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "name" text,
  "brand" text,
  "barcode" text,
  "image_url" text,
  "serving_qty" double precision,
  "serving_unit" text,
  "grams_per_serving" double precision,
  "nutrition" text,
  "notes" text,
  "favorite" integer,
  "source_provider" text,
  "source_id" text,
  "created_at" text,
  "updated_at" text,
  "deleted" integer,
  primary key (user_id, "id")
);

create table if not exists public.diary_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "date" text,
  "meal" text,
  "time" text,
  "name" text,
  "brand" text,
  "source_type" text,
  "source_id" text,
  "quantity" double precision,
  "unit" text,
  "serving_desc" text,
  "nutrition" text,
  "notes" text,
  "image_url" text,
  "created_at" text,
  "updated_at" text,
  primary key (user_id, "id")
);

create table if not exists public.saved_meals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "name" text,
  "image_url" text,
  "servings" double precision,
  "notes" text,
  "favorite" integer,
  "created_at" text,
  "updated_at" text,
  "deleted" integer,
  primary key (user_id, "id")
);

create table if not exists public.saved_meal_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "meal_id" text,
  "name" text,
  "quantity" double precision,
  "unit" text,
  "nutrition" text,
  "source_type" text,
  "source_id" text,
  "position" integer,
  primary key (user_id, "id")
);

create table if not exists public.recipes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "name" text,
  "image_url" text,
  "servings" double precision,
  "notes" text,
  "favorite" integer,
  "created_at" text,
  "updated_at" text,
  "deleted" integer,
  primary key (user_id, "id")
);

create table if not exists public.recipe_ingredients (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "recipe_id" text,
  "name" text,
  "quantity" double precision,
  "unit" text,
  "nutrition" text,
  "source_type" text,
  "source_id" text,
  "position" integer,
  primary key (user_id, "id")
);

create table if not exists public.food_log_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "food_key" text,
  "name" text,
  "meal" text,
  "logged_at" text,
  "image_url" text,
  primary key (user_id, "id")
);

create table if not exists public.search_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "query" text not null,
  "searched_at" text,
  primary key (user_id, "query")
);

create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "food_key" text not null,
  "created_at" text,
  primary key (user_id, "food_key")
);

create table if not exists public.activity_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "date" text,
  "name" text,
  "activity_type" text,
  "duration_min" double precision,
  "distance_km" double precision,
  "calories_burned" double precision,
  "intensity" text,
  "notes" text,
  "source_type" text,
  "source_id" text,
  "created_at" text,
  "updated_at" text,
  primary key (user_id, "id")
);

create table if not exists public.day_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "id" text not null,
  "date" text,
  "body" text,
  "created_at" text,
  "updated_at" text,
  primary key (user_id, "id")
);

-- ---------------------------------------------------------------------------
-- Shared trigger: pin ownership and stamp the pull cursor
-- ---------------------------------------------------------------------------

-- Ownership is assigned server-side rather than trusted from the payload, so a
-- forged user_id in a request body is overwritten instead of rejected. The RLS
-- policy would catch it too; this makes the request succeed correctly instead.
create or replace function public.sync_stamp_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new._synced_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-table boilerplate: tombstone + cursor columns, RLS, policy, trigger, index
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'settings', 'goal_configs', 'day_type_marks', 'meal_categories',
    'custom_foods', 'diary_entries', 'saved_meals', 'saved_meal_items',
    'recipes', 'recipe_ingredients', 'food_log_history', 'search_history',
    'favorites', 'activity_entries', 'day_notes'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table public.%I
         add column if not exists _deleted boolean not null default false,
         add column if not exists _synced_at timestamptz not null default now()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I
         for all
         to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t);

    execute format('drop trigger if exists %I on public.%I', t || '_stamp', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.sync_stamp_row()',
      t || '_stamp', t);

    -- Pull is always "my rows, changed since X", so the cursor index leads
    -- with user_id.
    execute format(
      'create index if not exists %I on public.%I (user_id, _synced_at)',
      'idx_' || t || '_cursor', t);

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;
