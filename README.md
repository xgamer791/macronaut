# Macronaut

Clean calorie and macro tracking. No ads, no tracking. Your diary is stored in
your own Supabase account and cached on each device, so it follows you between
phone and browser and still works offline.

**Test it now:** https://xgamer791.github.io/macronaut/ — the full app running in your browser, deployed from `main` on every push. On a build with no account server, adding `?demo=1` to the URL unlocks a "Load demo data" option in Settings (2+ weeks of sample history in one tap); it is off in builds with accounts, where it would write sample meals into a real diary.

![CI](https://github.com/xgamer791/macronaut/actions/workflows/ci.yml/badge.svg)

Built with React Native + Expo so the same codebase ships to iOS.

## Features

- **Today dashboard** — calorie ring, macro bars (protein/carbs/fat/fiber), weekly progress strip, meal summary, recent + frequent foods
- **Food diary** — six standard meals (plus custom categories), entry edit/duplicate/move, multi-select bulk actions, copy a meal or an entire day to another date, day navigation
- **Food search** — USDA FoodData Central + Open Food Facts, layered behind one service with local caching, debounced-as-you-type, branded/generic filters, recent searches
- **Built-in generic foods** — ~40 common meats, seafood and staples (chicken breast, ground beef by lean %, steaks, salmon, eggs, rice, oats…) bundled with the app: instant, offline, always ranked first for ingredient-style searches, weight-based with gram quick-picks (100/150/200/250/300 g)
- **Barcode scanning** — camera scan (iOS), manual entry everywhere, parallel lookup across all providers with barcode re-encoding variants (UPC-A/EAN-13/leading zeros), best-match-first with candidate selection, unknown-barcode → create custom food, camera button inside the custom-food form with full auto-prefill
- **Portions** — servings, g/kg/oz/lb, ml/cup/tbsp/tsp, pieces/slices/containers; nutrition recalculates on every change
- **Custom foods, saved meals, recipes** — full editors, favorites, duplicate/delete, live total + per-serving nutrition, log-in-one-action, save a meal straight from diary entries
- **Goals** — Mifflin-St Jeor recommendations from optional onboarding (skippable), same-daily / per-weekday / training-rest modes, per-date day-type marks, custom weekly targets, effective-dated versions so editing goals never rewrites history, **no rollover** between days or weeks
- **Progress** — tappable charts with goal line (7/30/90-day/custom ranges), per-metric averages and adherence, weekly averages, daily and weekly goal detail views with macro distribution
- **Edit before logging** — adjust any database food's values for one entry or save as your own custom food; flag inaccurate data locally
- **Offline** — diary, manual entries, custom foods, built-in generics, previously seen foods, recipes, meals, goals and progress all work with no connection
- **Accounts (optional)** — Supabase sign-in with Google or a six-digit email code, PKCE OAuth, sessions in the device keychain; every account gets its own local database so two people on one device never see each other's diary. With no Supabase project configured the app runs local-only, exactly as before — see [docs/accounts.md](docs/accounts.md)
- **Settings** — US/metric units, Sunday/Monday week start, light/dark/system appearance, custom meal categories, sign out, reset flows with confirmation, privacy + attribution

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo SDK 57 (managed), React Native 0.86, TypeScript strict |
| Navigation | expo-router (file-based), custom tab bar with center Add button |
| Data fetching | TanStack Query |
| Ephemeral state | Zustand |
| Persistence | SQLite — expo-sqlite (native), sql.js + IndexedDB (web), better-sqlite3 (tests) behind one `Database` interface; one database per account |
| Accounts | Supabase Auth (optional) — email OTP + Google OAuth with PKCE, Postgres + Row Level Security |
| Session storage | expo-secure-store (native), localStorage (web) |
| Charts | Custom SVG (react-native-svg) |
| Camera | expo-camera (barcode scanning) |
| Fonts | Space Grotesk (display) + platform body face |
| Tests | Jest + ts-jest, 125 tests |

## Folder structure

```
src/
  app/            expo-router routes (tabs, onboarding, modals, editors)
  db/             Database interface, 3 drivers, forward-only migrations
  domain/         PURE logic: nutrition math, servings, goals, aggregation, recommendations
  repositories/   diary / food / goals / collections / settings / history over the Database interface
  services/food/  USDA + Open Food Facts providers, bundled generics, layered search + barcode service
  state/          AppProvider (repo wiring), React Query hooks, Zustand UI store
  ui/             theme tokens + ~20 components
  utils/          day-key date math, navigation helper
  seed/           dev-only demo data
docs/             architecture, database schema, provider guide
```

## Getting started

```bash
git clone https://github.com/xgamer791/macronaut.git
cd macronaut
npm install
cp .env.example .env       # optional — add your USDA key
npm run web                # browser
npm run ios                # iOS simulator (needs Xcode)
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_USDA_API_KEY` | No | USDA FoodData Central key. Falls back to `DEMO_KEY` (heavily rate-limited — fine for a quick try). Get a free key at https://fdc.nal.usda.gov/api-key-signup |
| `EXPO_PUBLIC_SUPABASE_URL` | No | Overrides `supabase.json`. Only needed to aim one machine at a different project. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | No | Same, and only ever the **publishable (anon)** key — never `service_role` / `sb_secret_`, which the build and the app both refuse. |
| `EXPO_PUBLIC_BASE_PATH` | No | Set by the Pages deploy workflow only. Leave empty locally. |

No secrets are committed. `.env` is gitignored.

Every `EXPO_PUBLIC_*` value is compiled into the bundle every user downloads,
so treat all of them as public. That is fine for the Supabase publishable key,
which is designed for it and is backed by Row Level Security; it is *not* fine
for a provider secret — see [docs/security.md](docs/security.md).

### Accounts

Accounts are configured in [`supabase.json`](supabase.json), not in `.env`.
Paste your project URL and publishable key there and commit; both values are
public by design, so storing them in a CI secret would hide them from
contributors while still publishing them to every user. Empty means local-only.

With a project configured the app asks for a real sign-in and stores the
account's diary, goals, recipes and settings in Supabase, cached locally on
each device. Apply both migrations to the project first —
[`0001_accounts_and_rls.sql`](supabase/migrations/0001_accounts_and_rls.sql)
for the profile table and
[`0002_sync_tables.sql`](supabase/migrations/0002_sync_tables.sql) for the
fifteen tables the diary syncs into. Both enable and force Row Level Security,
so the database itself refuses to return another user's rows. Check the result
with `npm run verify:sync`. Full setup, including the Google provider and the
email-code template, is in [docs/accounts.md](docs/accounts.md).

### Food data providers

- **USDA FoodData Central** — generic (Foundation/SR) + branded foods. Sent: your search text or barcode only.
- **Open Food Facts** — packaged/international products + images, barcode-native. Sent: search text or barcode only.
- **Built-in generics** — bundled with the app, no network at all.

To add a provider, see [docs/providers.md](docs/providers.md).

## Testing

```bash
npm test             # 125 Jest tests: domain math, servings, goals, aggregation,
                     # repositories, migrations, providers, barcode variants, demo data
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint
```

The suite runs in plain Node (better-sqlite3 stands in for expo-sqlite), so no simulator or device is needed. CI runs all of it plus a full web export on every push.

## Building for production

- **Web:** `npm run export:web` → static site in `dist/` (deployed to GitHub Pages by `.github/workflows/deploy.yml`). Accounts go live once `supabase.json` on `main` has a project in it; empty means the workflow deploys the local-only build. `./scripts/verify-live.sh` reports which mode is actually serving. See [docs/accounts.md](docs/accounts.md#deploying-accounts-to-github-pages).
- **iOS:** `npx eas build --platform ios` with an Expo account, or `npx expo run:ios --configuration Release` locally with Xcode. Camera barcode scanning requires a real device.

## Known limitations

- Camera barcode scanning is unavailable on web (manual entry + demo barcode provided); it works on iOS/Android devices.
- USDA `DEMO_KEY` is rate-limited (~30 req/hr). Built-in generics and Open Food Facts keep search useful regardless.
- Sync resolves conflicts last-write-wins per row, biased toward the device you are using. Editing the same entry on two devices while both are offline keeps one of the two edits, not a merge.
- Your xAI API key is deliberately excluded from sync, so it has to be entered on each device.
- Sign in with Apple is not implemented yet, which iOS requires alongside Google sign-in; needed before App Store submission.
- Weekly goal detail defines weeks by your configured week start; partial first weeks show as-is.

## Roadmap

Sign in with Apple, MFA, Apple Health integration, widgets, Android polish, web dashboard.

## Documentation

- [Architecture notes](docs/architecture.md)
- [Database schema](docs/schema.md)
- [Accounts + Supabase setup](docs/accounts.md)
- [Security review](docs/security.md)
- [Food-data providers + adding your own](docs/providers.md)
