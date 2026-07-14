# Food-data providers

All food search and barcode lookup flows through
`src/services/food/foodSearchService.ts`, which layers:

1. **Bundled generics** (`genericFoods.ts`) — meats/seafood/staples with
   USDA SR-derived per-100 g nutrition. Instant, offline, no network.
2. **USDA FoodData Central** (`usda.ts`) — generic + branded US foods.
   Key via `EXPO_PUBLIC_USDA_API_KEY` (falls back to rate-limited `DEMO_KEY`).
3. **Open Food Facts** (`openFoodFacts.ts`) — packaged/international foods
   with images; barcode-native. No key.
4. **Nutritionix / FatSecret / restaurant** — provider ids and confidence
   trust are wired in `types.ts` / `confidence.ts`; implement `FoodProvider`
   and register in `createFoodSearchService` when credentials are available.

Network providers share `httpClient.ts` (retries, timeout, rate limit,
User-Agent). Barcodes are normalized via `barcodeNormalize.ts` before fan-out.

What each provider receives: your search text or a scanned barcode — never
diary data or personal information.

## Behavior

- **Search** queries all network providers in parallel
  (`Promise.allSettled`) plus the bundled dataset, dedupes by
  barcode/name+brand+prep, ranks by intent (bundled generics → reference
  foods → branded, then name-match + confidence), and upserts into
  `cached_foods` (incl. restaurant, preparation_state, ingredients,
  allergens, verified, category). One provider failing never blocks the
  others; total failure falls back to the local cache + bundled generics.
- **Barcode** resolves: custom foods → confident cache → all providers ×
  all barcode re-encodings in parallel. Conflict rules pick a single winner
  (never average). Remaining hits are candidates.
- **Grouping** (for UI): `bestMatch`, `usdaWholeFoods`, `packagedFoods`,
  `restaurantFoods`, `myFoods` via `grouping.ts`.

## Adding a provider

1. Create `src/services/food/myProvider.ts` implementing `FoodProvider`
   (`search`, `getByBarcode`) from `types.ts`, mapping into `ProviderFood`
   (incl. optional `restaurant`, `preparationState`, `ingredients`,
   `allergens`, `verified`, `category`, `saturatedFat` in nutrition).
   Prefer `foodHttp` from `httpClient.ts`. Throw `ProviderError` with a
   `kind` for polished error UI.
2. Add its id to `ProviderId` in `types.ts` (already includes
   `nutritionix` | `fatsecret` | `restaurant`) and a `SOURCE_LABEL` /
   `SOURCE_TRUST` entry.
3. Register it in the default provider array in `createFoodSearchService`.

Search, caching, ranking, conflict resolution, offline fallback, barcode
variants and the scan UIs pick it up automatically.
