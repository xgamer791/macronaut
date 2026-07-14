# Architecture notes

## Layering

```
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
and what makes a future cloud-sync backend a swap, not a rewrite — implement
the repository interfaces against a server API (or add a sync engine beneath
the SQLite driver) and no screen changes.

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
- **Bundled generics.** Common meats/staples ship in the binary
  (`services/food/genericFoods.ts`) so ingredient searches are instant,
  offline, and immune to provider rate limits; ranked above network results
  for ingredient-style queries.

## Future-proofing (deliberately not built yet)

Accounts, cloud sync, iCloud backup, multi-device, Android, web dashboard.
The seams for them: repository interfaces (swap/decorate for sync), the
`Database` driver (add replication), effective-dated goal versions and
snapshot entries (merge-friendly), and `getDatabase()` as the single
composition point.
