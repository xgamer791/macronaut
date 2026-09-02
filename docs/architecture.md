# Architecture notes

## Layering

```
AuthProvider (src/state)          Convex Auth session → who the caller is
  ↓
UI (src/app, src/ui)              screens + components, no fetch, no API calls
  ↓ React Query hooks (src/state)
Repositories (src/repositories)   one per domain, thin clients over the Convex API
  ↓ ConvexReactClient (src/services/convex)
Convex functions (convex/)        queries + mutations, every one scoped to the caller
  ↓
Convex database                   one schema (convex/schema.ts), every table keyed by userId
Pure domain (src/domain)          math only — no React, no network
Food services (src/services/food) providers + layered search/barcode
```

**The rule that holds it together:** screens depend on repository interfaces,
repositories depend on the generated Convex API, and all calculation lives in
`src/domain` with zero dependencies. That is what lets the app's own test
suite run in plain Node with in-memory repositories, and what lets the backend
suite run the real Convex functions through the real repositories against
convex-test's in-memory backend — the same code path a device uses, minus the
WebSocket.

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
- **Ownership is decided on the server.** Every function in `convex/`
  resolves the caller from the verified session (`requireUserId`), reads only
  through indexes that start with that `userId`, and checks the owner before
  touching an existing row. The client never sends a user id, so it cannot
  send the wrong one. `tests/convex/isolation.test.ts` pins this down.
- **Auth is not a local flag.** Route guards read Convex Auth's verified
  session state, never a value the device can edit. There is no signed-out
  mode with data in it: without a session nothing loads.
- **Settings are JSON text per key.** Shapes vary per key (profile, assistant
  memory, meal times) and grow over time; storing them as text on the server
  keeps that flexibility without schema churn. Everything queried by field
  has real columns and indexes.
- **Saved meals and recipes embed their items.** A parent and its items are
  always read and replaced together, so they are one document, not two
  tables joined on every read.
- **The provider cache is per account.** Repeat searches and barcode scans
  resolve from the account's `cachedFoods` rows; a user's correction or flag
  on a record is theirs and survives provider refreshes.
- **Bundled generics.** Common meats/staples ship in the binary
  (`services/food/genericFoods.ts`) so ingredient searches are instant and
  immune to provider rate limits; ranked above network results for
  ingredient-style queries.

## Deployment

`npx convex deploy --cmd 'npm run export:web'` pushes `convex/` and builds the
web bundle against the deployment it just pushed, so the two can never drift.
See [accounts.md](accounts.md#deploying).

## Future-proofing (deliberately not built yet)

Sign in with Apple, MFA, offline write queueing, Apple Health, Android, web
dashboard. The seams for them: the repository interfaces (decorate for an
offline queue), Convex's reactive queries (swap React Query hooks for
`useQuery` from `convex/react` screen by screen for live updates), and
effective-dated goal versions plus snapshot entries (merge-friendly).
