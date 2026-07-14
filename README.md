# Macronaut

Clean calorie and macro tracking. Local-first, no accounts, no ads, no tracking.

**Test it now:** https://xgamer791.github.io/macronaut/ — the full app running in your browser, deployed from `main` on every push. Add `?demo=1` to the URL to unlock a "Load demo data" option in Settings (2+ weeks of sample history in one tap).

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
- **Settings** — US/metric units, Sunday/Monday week start, light/dark/system appearance, custom meal categories, reset flows with confirmation, privacy + attribution

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo SDK 57 (managed), React Native 0.86, TypeScript strict |
| Navigation | expo-router (file-based), custom tab bar with center Add button |
| Data fetching | TanStack Query |
| Ephemeral state | Zustand |
| Persistence | SQLite — expo-sqlite (native), sql.js + IndexedDB (web), better-sqlite3 (tests) behind one `Database` interface |
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
| `EXPO_PUBLIC_BASE_PATH` | No | Set by the Pages deploy workflow only. Leave empty locally. |

No secrets are committed. `.env` is gitignored.

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

- **Web:** `npm run export:web` → static site in `dist/` (deployed to GitHub Pages by `.github/workflows/deploy.yml`).
- **iOS:** `npx eas build --platform ios` with an Expo account, or `npx expo run:ios --configuration Release` locally with Xcode. Camera barcode scanning requires a real device.

## Known limitations

- Camera barcode scanning is unavailable on web (manual entry + demo barcode provided); it works on iOS/Android devices.
- USDA `DEMO_KEY` is rate-limited (~30 req/hr). Built-in generics and Open Food Facts keep search useful regardless.
- Single local profile; no accounts or sync yet (the repository layer is built to add a sync backend without rewriting the app — see [docs/architecture.md](docs/architecture.md)).
- Weekly goal detail defines weeks by your configured week start; partial first weeks show as-is.

## Roadmap

Accounts + cloud sync, iCloud backup, Apple Health integration, widgets, Android polish, web dashboard.

## Documentation

- [Architecture notes](docs/architecture.md)
- [Database schema](docs/schema.md)
- [Food-data providers + adding your own](docs/providers.md)
