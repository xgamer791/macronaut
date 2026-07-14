# Food-data providers

All food search and barcode lookup flows through
`src/services/food/foodSearchService.ts`, which layers:

1. **Bundled generics** (`genericFoods.ts`) — ~40 meats/seafood/staples with
   USDA SR-derived per-100 g nutrition. Instant, offline, no network.
2. **USDA FoodData Central** (`usda.ts`) — generic + branded US foods.
   Key via `EXPO_PUBLIC_USDA_API_KEY` (falls back to rate-limited `DEMO_KEY`).
3. **Open Food Facts** (`openFoodFacts.ts`) — packaged/international foods
   with images; barcode-native. No key.

What each provider receives: your search text or a scanned barcode — never
diary data or personal information.

## Behavior

- **Search** queries all network providers in parallel
  (`Promise.allSettled`) plus the bundled dataset, dedupes by
  barcode/name+brand, ranks by intent (bundled generics → reference foods →
  branded, then name-match quality), and upserts everything into the
  `cached_foods` table for offline reuse. One provider failing never blocks
  the others; total failure falls back to the local cache + bundled generics.
- **Barcode** resolves: your custom foods → local cache → all providers × all
  barcode re-encodings (raw, stripped leading zeros, padded UPC-A/EAN-13) in
  parallel. Best match is chosen by provider fitness (Open Food Facts first,
  then richer records); remaining hits are offered as selectable candidates.

## Adding a provider

1. Create `src/services/food/myProvider.ts` implementing `FoodProvider`
   (`search`, `getByBarcode`) from `types.ts`, mapping responses into
   `ProviderFood` (nutrition per 100 g and/or per serving, grams per serving
   when known). Throw `ProviderError` with a `kind` for polished error UI.
2. Add it to the default provider array in `createFoodSearchService`.
3. Add its id to `ProviderId` in `types.ts` and a `sourceLabel` in the food
   detail screen.

Search, caching, ranking, offline fallback, barcode variants and the scan
UIs pick it up automatically.
