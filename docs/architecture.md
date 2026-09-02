# Architecture notes

## Layering

```
AuthProvider (src/state)      Supabase session → local database scope
  ↓
UI (src/app, src/ui)          screens + components, no SQL, no fetch
  ↓ React Query hooks (src/state)
Repositories (src/repositories)   all persistence, one per domain
  ↓ Database interface (src/db/driver.ts)
Drivers: expo-sqlite (native) · sql.js + IndexedDB (web) · better-sqlite3 (tests)
Pure domain (src/domain)      math only — no React, no DB, no network
Food services (src/services/food)  providers + layered search/barcode
```

**The rule that holds it together:** repositories depend only on the
`Database` interface, and all calculation lives in `src/domain` with zero
dependencies. That is what makes the whole data layer testable in plain Node
and what let cloud sync land beneath the SQLite driver without touching a
single repository or screen.

## Key decisions

- **Day keys, not Dates.** All diary/goal logic uses local `YYYY-MM-DD`
  strings so timezone shifts can never move an entry between days.
- **Nutrition snapshots.** Diary entries store the full scaled nutrition (and
  image) at log time. Editing a food later never rewrites history.
- **Effective-dated goals.** Editing goals writes a new version effective
  today; historical days resolve against the version in effect then, so past
  adherence is immutable. Target resolution precedence:
  per-date training/rest mark → weekly pattern → per-weekday override → base.
- **No rollover by construction.** Aggregation only compares a day's total to
  that day's resolved target; weekly numbers are Σ(7 daily targets) or an
  explicit weekly target. Nothing ever reads "yesterday's remaining".
- **Web persistence.** GitHub Pages can't serve COOP/COEP headers, so the web
  driver runs sql.js in memory and persists serialized bytes to IndexedDB
  (debounced after writes). Same schema, same migrations, same repositories.
- **Supabase owns the data; SQLite is the cache.** Screens read and write
  locally, so nothing waits on the network and the app works offline. Triggers
  record every change into `sync_outbox` and `src/services/sync` reconciles it
  with the account's Postgres tables. Because the database tracks its own
  changes, no repository knows sync exists and none can forget to. See
  [accounts.md](accounts.md#how-sync-works).
- **One database per account.** `getDatabase(scope)` opens a separate SQLite
  file (native) or IndexedDB record (web) per signed-in account, resolved by
  `src/db/scope.ts` before any screen mounts. Accounts on a shared device
  cannot read each other's rows, and the pre-accounts database is adopted by
  the first account to sign in so upgrades keep their history. See
  [accounts.md](accounts.md) and [security.md](security.md).
- **Auth is not a local flag.** Route guards read a verified Supabase session,
  never a value the device can edit. With no Supabase project configured the
  app runs local-only instead of pretending to be signed in.
- **Bundled generics.** Common meats/staples ship in the binary
  (`services/food/genericFoods.ts`) so ingredient searches are instant,
  offline, and immune to provider rate limits; ranked above network results
  for ingredient-style queries.

## Future-proofing (deliberately not built yet)

iCloud backup, Android, web dashboard. The seams for them: repository
interfaces (swap/decorate), the `Database` driver, effective-dated goal
versions and snapshot entries
(merge-friendly), `getDatabase(scope)` as the single composition point, and the
account identity now supplied by `AuthProvider`. The Row Level Security
template at the bottom of `supabase/migrations/0001_accounts_and_rls.sql` is
the shape each synced table should take.
