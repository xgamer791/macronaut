# Macronaut

Clean calorie and macro tracking. No ads, no tracking. Your diary lives in
your account on [Convex](https://convex.dev), so phone and web always show the
same data.

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
- **One account, every device** — diary, foods, meals, recipes, goals, activity, notes and settings are stored in your Convex account and served live to every signed-in device; built-in generic foods still need no network
- **Accounts** — Convex Auth sign-in with Apple, Google (OAuth code flow with PKCE) or a six-digit email code delivered by Resend; Apple uses its own sheet on iOS and the same OAuth round trip everywhere else; sessions in the device keychain; every row is scoped to its account on the server, so nobody can read anyone else's diary — see [docs/accounts.md](docs/accounts.md)
- **Settings** — US/metric units, Sunday/Monday week start, light/dark/system appearance, custom meal categories, sign out, delete all data, delete account, privacy + attribution

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo SDK 57 (managed), React Native 0.86, TypeScript strict |
| Navigation | expo-router (file-based), custom tab bar with center Add button |
| Data fetching | TanStack Query |
| Ephemeral state | Zustand |
| Backend | Convex — functions in `convex/`, every table scoped to the signed-in account on the server; the app reaches it through one repository layer |
| Accounts | Convex Auth — Apple and Google OAuth with PKCE, native Sign in with Apple on iOS, six-digit email codes via Resend; every secret is a deployment variable, never in the bundle |
| Session storage | expo-secure-store (native), localStorage (web) |
| Charts | Custom SVG (react-native-svg) |
| Camera | expo-camera (barcode scanning) |
| Fonts | Space Grotesk (display) + platform body face |
| Tests | Jest + ts-jest for the app; Vitest + convex-test for the backend functions |

## Folder structure

```
convex/           the backend: schema, auth providers, one module of queries/mutations per domain
src/
  app/            expo-router routes (tabs, onboarding, modals, editors)
  domain/         PURE logic: nutrition math, servings, goals, aggregation, recommendations
  repositories/   diary / food / goals / collections / settings / history / account — thin clients over the Convex API
  services/food/  USDA + Open Food Facts providers, bundled generics, layered search + barcode service
  services/auth/  email validation, OAuth redirect URL, Apple nonce + name, display name
  state/          AuthProvider (Convex Auth), AppProvider (repo wiring), React Query hooks, Zustand UI store
  ui/             theme tokens + ~20 components
  utils/          day-key date math, navigation helper
  seed/           dev-only demo data
tests/convex/     backend function tests (Vitest + convex-test)
docs/             architecture, database schema, accounts + deployment, provider guide
```

## Getting started

```bash
git clone https://github.com/xgamer791/macronaut.git
cd macronaut
npm install
npx convex dev             # links your dev deployment, writes .env.local, pushes convex/
cp .env.example .env       # optional — add your USDA key
npm run web                # browser
npm run ios                # iOS simulator (needs Xcode)
```

`npx convex dev` needs a free Convex account. Sign-in also needs a few
variables on that deployment (Google client, Apple Services ID and client
secret, Resend key, session keys) — the walkthrough is in
[docs/accounts.md](docs/accounts.md).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_USDA_API_KEY` | No | USDA FoodData Central key. Falls back to `DEMO_KEY` (heavily rate-limited — fine for a quick try). Get a free key at https://fdc.nal.usda.gov/api-key-signup |
| `EXPO_PUBLIC_CONVEX_URL` | Yes | The Convex deployment the app talks to. `npx convex dev` writes it to `.env.local`; the deploy workflow sets it from `npx convex deploy`. |
| `EXPO_PUBLIC_BASE_PATH` | No | Set by the Pages deploy workflow only. Leave empty locally. |

No secrets are committed. `.env` is gitignored.

Every `EXPO_PUBLIC_*` value is compiled into the bundle every user downloads,
so treat all of them as public. That is fine for the Convex URL, which is the
address clients are meant to connect to; it is *not* fine for a provider
secret — see [docs/security.md](docs/security.md).

### Accounts and the backend

The app has one backend, a Convex deployment, and requires an account. All
secrets — the Google OAuth client secret, the Apple client secret JWT, the
Resend key, the session signing key — are environment variables on that
deployment. The deploy workflow needs
exactly one repository secret, `CONVEX_DEPLOY_KEY`. Setup for both is in
[docs/accounts.md](docs/accounts.md).

### Food data providers

- **USDA FoodData Central** — generic (Foundation/SR) + branded foods. Sent: your search text or barcode only.
- **Open Food Facts** — packaged/international products + images, barcode-native. Sent: search text or barcode only.
- **Built-in generics** — bundled with the app, no network at all.

To add a provider, see [docs/providers.md](docs/providers.md).

## Testing

```bash
npm test             # Jest: domain math, servings, goals, aggregation, food engine,
                     # demo data (in-memory repositories)
npm run test:convex  # Vitest + convex-test: the real Convex functions, driven through
                     # the app's repositories, including the account-isolation check
npm run typecheck    # tsc --noEmit (strict), app and backend
npm run lint         # eslint
```

Both suites run in plain Node against an in-memory backend, so no simulator, device or Convex deployment is needed. CI runs all of it plus a full web export on every push.

## Building for production

- **Web:** every push to `main` runs `.github/workflows/deploy.yml`, which deploys `convex/` to the production deployment and exports the web build against it in one step (`npx convex deploy --cmd 'npm run export:web'`), then publishes `dist/` to GitHub Pages. `./scripts/verify-live.sh` reports which backend the live bundle points at. See [docs/accounts.md](docs/accounts.md#deploying).
- **iOS:** `npx eas build --platform ios` with an Expo account, or `npx expo run:ios --configuration Release` locally with Xcode. Camera barcode scanning requires a real device.

## Known limitations

- Camera barcode scanning is unavailable on web (manual entry + demo barcode provided); it works on iOS/Android devices.
- USDA `DEMO_KEY` is rate-limited (~30 req/hr). Built-in generics and Open Food Facts keep search useful regardless.
- The app needs a connection: the diary is read from and written to the account on Convex. Built-in generic foods are the only data bundled with the app.
- Apple refuses `localhost` and plain HTTP, so Sign in with Apple on the web can only be tested against the deployed site; the iOS sheet needs a device build, since Expo Go cannot carry the entitlement.
- Weekly goal detail defines weeks by your configured week start; partial first weeks show as-is.

## Roadmap

MFA, offline queueing of writes, Apple Health integration, widgets, Android polish, web dashboard.

## Documentation

- [Architecture notes](docs/architecture.md)
- [Database schema](docs/schema.md)
- [Accounts, the Convex backend and deployment](docs/accounts.md)
- [Security review](docs/security.md)
- [Food-data providers + adding your own](docs/providers.md)
