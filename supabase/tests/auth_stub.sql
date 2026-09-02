-- Minimal stand-in for the parts of Supabase that the migrations depend on, so
-- they can be applied and exercised against a plain PostgreSQL server.
--
-- Only used by supabase/tests/run.sh. Never run this against a real project.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Supabase derives the caller from the JWT. Locally we read the same claim out
-- of a session setting, which `set request.jwt.claim.sub` can drive.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
