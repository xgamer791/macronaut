# Accounts (Supabase)

Macronaut runs in one of two modes, decided at build time by whether a Supabase
project URL and publishable key are configured.

| Mode | When | Sign-in | Data |
|---|---|---|---|
| Local-only | No project configured (the public GitHub Pages demo) | "Continue on this device" | One local database, nothing leaves the device |
| Accounts | A project is configured | Google, or a six-digit email code | Stored in the account on Supabase, cached locally so the app works offline |

Two places supply that configuration, and an environment variable wins over the
file:

| Source | Use it for |
|---|---|
| [`supabase.json`](../supabase.json) at the repo root | The project this app deploys with. Committed, because both values are public. |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | A local `.env`, or a fork pointing at a different project, without editing tracked files. |

Committing these two values is deliberate, not an oversight. Both are compiled
into the JavaScript bundle every user downloads no matter where they are stored,
so a CI secret would hide them from contributors while publishing them to the
world. The publishable key is designed to be public; Row Level Security is what
protects the data. The `service_role` / `sb_secret_` key is the opposite and
must never go in either place — the build script and the app both refuse it.

In accounts mode the diary belongs to the account, not the device: sign in
anywhere and your food, goals, recipes and settings are there. The local
database is still the one every screen reads and writes, so the app stays fast
and works offline — it is a cache that is reconciled with Supabase in the
background. See [How sync works](#how-sync-works) below.

## Project setup

### 1. Create the project

Create a free project at [supabase.com](https://supabase.com), then copy
**Project URL** and the **publishable (anon) key** from Project Settings → API
into `supabase.json`:

```json
{
  "url": "https://<project-ref>.supabase.co",
  "anonKey": "sb_publishable_..."
}
```

Committing that file is all it takes to turn accounts on, locally and on the
live site. To point one machine at a different project instead, put the same
values in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`; they override the file.

Never use the `service_role` / `sb_secret_` key. It bypasses Row Level Security,
and every value here ships inside the JavaScript bundle. `scripts/supabase-config.mjs`
fails the build if it sees one, and the app refuses to create a client from it.

### 2. Apply the schema

Run [`supabase/migrations/0001_accounts_and_rls.sql`](../supabase/migrations/0001_accounts_and_rls.sql)
in the SQL editor, or `supabase db push` with the CLI. It creates `profiles`,
enables and forces Row Level Security, grants `authenticated` only the columns
it needs, gives `anon` nothing, and provisions each profile from a
`security definer` trigger on `auth.users`.

The file ends with the template every future user-owned table should copy, so
isolation is written into the table definition rather than remembered later.

Then run [`supabase/migrations/0002_sync_tables.sql`](../supabase/migrations/0002_sync_tables.sql).
It creates the fifteen tables the diary syncs into — entries, goals, custom
foods, saved meals, recipes, activity, notes, history and settings — each keyed
by `user_id`, each under forced Row Level Security. **Until this runs, sign-in
works but nothing syncs**, and Settings shows "Sync paused".

Both files are safe to run again; re-pasting either one changes nothing.

To check the schema and its isolation without a Supabase project, apply them to
a throwaway local Postgres:

```bash
npm run test:rls
```

### 3. Enable the email code

Email sign-in uses a one-time code rather than a magic link, so it works
identically on web, iOS and Android with no deep-link or universal-link setup.

Supabase's default magic-link template only contains a URL, so add the token to
it under **Authentication → Email Templates → Magic Link**:

```html
<h2>Your Macronaut sign-in code</h2>
<p>{{ .Token }}</p>
<p>This code expires shortly. If you didn't ask for it, ignore this email.</p>
```

Under **Authentication → Providers → Email**, confirm "Enable Email provider"
is on. Leave "Confirm email" on: `verifyOtp` confirms the address as part of
signing in.

The built-in SMTP service is rate-limited to a handful of emails per hour and
is not meant for production. Configure your own SMTP under **Authentication →
Emails → SMTP Settings** before real users arrive.

### 4. Enable Google

Under **Authentication → Providers → Google**, add the OAuth client ID and
secret from the Google Cloud console. In Google Cloud, the authorised redirect
URI is Supabase's callback:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Then add the URLs the app itself returns to, under **Authentication → URL
Configuration → Redirect URLs**:

```
macronaut://                                  # native (Expo scheme from app.config.ts)
http://localhost:8081/                        # expo start --web
https://xgamer791.github.io/macronaut/        # GitHub Pages deploy
```

The GitHub Pages entry **must include the `/macronaut/` sub-path**. The site is
served from a sub-path, not the domain root, and Supabase matches redirect URLs
exactly (or by explicit wildcard, e.g.
`https://xgamer791.github.io/macronaut/**`). An entry for the bare host will not
match and sign-in will fail. `authRedirectUrl()` builds the same URL from
`EXPO_PUBLIC_BASE_PATH`, so the two stay in step.

Set **Site URL** to the same GitHub Pages URL.

That allow-list is a security control, not configuration noise: it is what
stops an attacker sending the authorization code to a site they control.
Supabase rejects any `redirectTo` that is not on it, so add only origins you
own.

Sign-in uses the PKCE flow, so the authorization code is worthless without the
verifier held by the client that started the flow.

### 5. Verify

First confirm the project is actually ready to hold diaries:

```bash
npm run verify:sync
```

It probes every table the sync engine writes to and reports one of three
things: the table is missing (migration 0002 has not been run), the table
answers an anonymous read (Row Level Security is not doing its job — stop), or
the table exists and refuses to talk to anyone who is not signed in, which is
the answer you want.

Then the round trip:

```bash
npm run web
```

Sign in with an email code, add a diary entry, sign out, then sign in as a
second address. The second account must see an empty diary. Sign back in as the
first and its entries must return. That round trip is the isolation guarantee —
if it fails, stop and fix it before shipping.

Finally, the guarantee that sync exists for: sign in as the first account in a
**different browser** (or a private window). The diary entry you just made must
appear there without you doing anything.

## Deploying accounts to GitHub Pages

Filling in `supabase.json` on `main` is the whole deploy step. Editing it in the
GitHub web UI works: the push triggers `.github/workflows/deploy.yml`, which
compiles the values into the bundle and publishes it.

Repository secrets or variables named `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` still override the file if you would rather keep
the project reference out of the tree.

With the file empty and no variables set, the workflow deploys the local-only
build — which is what the public demo has always been, so nothing breaks by
leaving it alone.

Two build-time checks keep a broken config from reaching users, both in
`scripts/supabase-config.mjs`: a source that fills in only one of `url` /
`anonKey` fails the build rather than deploying half-configured, and a
privileged key fails it rather than publishing the key. The workflow then fails
the deploy if the project host is missing from the exported bundle, since a
config that never reached the bundler otherwise produces a local-only site that
looks like a successful deploy.

After the deploy finishes, confirm which mode actually went live:

```bash
./scripts/verify-live.sh
```

It reports `auth=accounts (supabase project: …)` or `auth=local-only`, read from
the bundle the CDN is really serving rather than from the repository settings.

Finally, run the two-account round trip from step 5 above against the live URL.
Sign-in cannot work until the Supabase redirect allow-list contains
`https://xgamer791.github.io/macronaut/`, including the sub-path.

## How sync works

Every screen reads and writes the local SQLite database, exactly as before.
Nothing waits on the network, and the app works with no connection at all. A
background reconciler moves those writes up to Supabase and brings down what
changed elsewhere.

**Recording changes.** The app has around forty repository methods that write
to the diary. Teaching each one to also call Supabase would mean touching all
of them and silently missing any write added later. Instead the database
records its own changes: `src/db/migrations/009_sync_outbox.ts` puts an
`AFTER INSERT / UPDATE / DELETE` trigger on each account-owned table, and each
trigger drops a row into `sync_outbox`. Repositories are untouched and cannot
forget. The outbox is keyed by table and row, not append-only, so editing one
entry fifty times before the next sync still uploads it once.

**Reconciling.** `src/services/sync/engine.ts` pushes the outbox, then pulls
anything the server has stamped since the last cursor. Push runs first so a row
edited here wins over the server's copy; pull then skips any row still sitting
in the outbox, since that is a change made after the push began and is newer
still. Conflicts resolve last-write-wins per row, biased toward the device in
the user's hand. Applying a pulled row fires the local triggers, which would
queue it straight back for upload, so the engine clears that echo in the same
transaction.

Which tables sync is declared once, in `src/services/sync/tables.ts`. Both the
trigger migration and the engine read that list. `cached_foods` is deliberately
excluded: it is a provider cache, identical for every user and refillable from
the network.

**Scheduling.** `src/state/SyncProvider.tsx` syncs on sign-in, a few seconds
after local writes, on a slow timer for other devices' changes, and whenever
the app returns to the foreground. Failures back off exponentially. Settings →
Account shows the current state and syncs on tap.

**First launch on a device blocks.** Until the initial download finishes, the
local database is empty — and an empty database is indistinguishable from a new
user, so the app would send someone with a year of history to the onboarding
screen while their diary was still arriving. `SyncProvider` holds the UI until
that first sync completes, and records that it did so; every launch afterwards
renders immediately and syncs behind the screen. If the first sync cannot reach
the server the app still opens, and tries again rather than settling into a
permanently empty diary.

**Deletions travel as tombstones.** A deleted row is kept server-side with
`_deleted = true` rather than removed, so the user's other devices learn it is
gone instead of re-uploading their stale copy and resurrecting it.

## How isolation works on the device

Before accounts there was one local SQLite database per device. Adding sign-in
without scoping it would hand the next person to sign in on a shared phone or
browser the previous account's diary.

`src/db/scope.ts` resolves a database scope per account:

- Local-only mode uses the pre-accounts database.
- The first account to sign in on the device **adopts** the pre-accounts
  database, so anyone upgrading keeps the history they already had.
- Every account after that gets its own SQLite file (native) or IndexedDB
  record (web).
- If the scope cannot be recorded — locked keychain, disabled storage — the
  account falls back to a scope private to its user id. Failing closed keeps a
  broken device from becoming a data leak.

`AuthProvider` resolves the scope before children mount and remounts
`AppProvider` when it changes, so no repository outlives the account it was
created for. The React Query cache is cleared on every scope change, because a
cached diary result belongs to whoever fetched it.

Signing out does not erase the local database: the account keeps its cached
copy for next time.

Settings → Data → **Delete all data** now erases the account, not just the
device. It runs `DELETE` against the local tables, the triggers turn those into
tombstones, and the next sync removes the rows from Supabase and from every
other device the user owns. That is what "delete" means once data is synced, so
the confirmation says so rather than promising a device-local wipe it cannot
deliver.

## Session storage

Sessions live in `expo-secure-store` on native (Keychain /
EncryptedSharedPreferences) and `localStorage` on web, which is all a static
host can offer. Values are chunked because SecureStore rejects anything over
2048 bytes and a Supabase session is bigger than that.

Refresh tokens rotate automatically, and auto-refresh is restarted when the app
returns to the foreground so iOS suspending the timer does not strand a stale
session. `signOut` uses `scope: 'local'`, so signing out of one device leaves
the user's other devices signed in.
