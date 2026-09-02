-- What stops one Macronaut account from reading another's food diary is a Row
-- Level Security policy on fifteen tables. That is a single line of SQL per
-- table with nothing else behind it, so it is worth proving rather than
-- assuming. Run with supabase/tests/run.sh.

\set ON_ERROR_STOP on

\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email) values
  (:'alice', 'alice@example.com'),
  (:'bob', 'bob@example.com')
on conflict do nothing;

set role authenticated;

-- --- Alice logs a meal -------------------------------------------------------
set request.jwt.claim.sub = :'alice';

insert into public.diary_entries (id, "date", meal, name, nutrition)
values ('alice-entry', '2026-03-01', 'breakfast', 'Alice oats', '{}');

select 'alice sees own rows' as check, count(*) = 1 as pass from public.diary_entries;

select 'ownership defaulted to alice' as check, count(*) = 1 as pass
from public.diary_entries where user_id = :'alice';

-- --- Bob must not be able to read, change or remove it -----------------------
set request.jwt.claim.sub = :'bob';

select 'bob cannot read alice rows' as check, count(*) = 0 as pass from public.diary_entries;

update public.diary_entries set name = 'hijacked' where id = 'alice-entry';
delete from public.diary_entries where id = 'alice-entry';

-- A forged user_id in the payload is overwritten by the stamping trigger, so
-- Bob cannot plant rows inside Alice's account.
insert into public.diary_entries (user_id, id, "date", meal, name, nutrition)
values (:'alice', 'bob-forged', '2026-03-01', 'lunch', 'Bob forged', '{}');

select 'forged user_id rewritten to caller' as check, user_id = :'bob' as pass
from public.diary_entries where id = 'bob-forged';

-- --- Alice is untouched ------------------------------------------------------
set request.jwt.claim.sub = :'alice';

select 'alice row survived' as check,
       count(*) = 1 and min(name) = 'Alice oats' as pass
from public.diary_entries;

select 'bob rows invisible to alice' as check, count(*) = 0 as pass
from public.diary_entries where id = 'bob-forged';

-- --- The pull cursor advances on every write ---------------------------------
-- Without this, a change made on one device is never handed to the others.
create temp table cursor_before as
  select _synced_at as stamp from public.diary_entries where id = 'alice-entry';

with bumped as (
  update public.diary_entries set name = 'Alice oats, edited'
  where id = 'alice-entry'
  returning _synced_at as stamp
)
select 'cursor advances on update' as check, bumped.stamp > cursor_before.stamp as pass
from bumped, cursor_before;

-- --- Deleting is a tombstone, so other devices learn about it ----------------
update public.diary_entries set _deleted = true where id = 'alice-entry';

select 'tombstone is still readable by owner' as check, count(*) = 1 as pass
from public.diary_entries where id = 'alice-entry' and _deleted;

reset role;
