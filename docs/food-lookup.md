# Food lookup pipeline

All food lookup — barcode, search, and ingredient pickers — flows through one
centralized pipeline in `src/services/food/`. No lookup logic lives in UI
components. Every result is normalized, validated, confidence-scored,
prep-filtered, conflict-resolved, ranked, and grouped before it reaches the
screen.

## Pipeline (search)

1. User-submitted **My Foods** (`custom_foods`) — always included when the query matches
2. Local `cached_foods` (prioritize previously seen provider foods)
3. Bundled generics + official restaurant foods
4. Parallel providers: USDA (POST `/foods/search`), Nutritionix (if configured),
   FatSecret (if configured), Open Food Facts
5. Normalize → validate → confidence → meat prep filter → dedupe →
   conflict resolve (never average) → rank → group
6. Return flat `foods` (backward compat) + `groups` (Best Match, USDA Whole
   Foods, Packaged, Restaurant, **My Foods**) + optional `autoSelected`
   (only when confidence ≥ 0.80)

## Pipeline (barcode)

1. Normalize GTIN / UPC variants (EAN-8, UPC-A, EAN-13, GTIN-14)
2. Custom foods → confident cache
3. Parallel: Nutritionix → FatSecret → USDA branded → OFF (ordered, variants fan-out)
4. Rank → best match → merge best product image (prefer manufacturer-like URLs) → cache

## Services

| Service | File | Responsibility |
|---|---|---|
| FoodSearchService | `foodSearchService.ts` | Orchestration, prefetch, auto-select |
| httpClient | `httpClient.ts` | Shared fetch: retries, timeout, rate limit |
| barcodeNormalize | `barcodeNormalize.ts` | UPC/EAN/GTIN → GTIN-13 + variants |
| preparation | `preparation.ts` | Prep detect; never raw↔cooked for meats |
| conflict | `conflict.ts` | Never-average winner selection |
| ranking / grouping | `ranking.ts` / `grouping.ts` | Score + UI sections |
| internalFood | `internalFood.ts` | Standard schema converter |
| nutritionix / fatsecret | `nutritionix.ts` / `fatsecret.ts` | Optional licensed providers |
| restaurantFoods | `restaurantFoods.ts` | Bundled official chain nutrition |
| USDA / OFF / local | `usda.ts` / `openFoodFacts.ts` / `genericFoods.ts` | Core sources |

## USDA notes

- Uses **POST** `https://api.nal.usda.gov/fdc/v1/foods/search` (query + `dataType`
  array in JSON body) with `EXPO_PUBLIC_USDA_API_KEY` or `DEMO_KEY`.
- Results are sorted Foundation → SR Legacy → Survey (FNDDS) → Branded.
- Bare nginx `400` responses from DEMO_KEY bursts are treated as rate limits
  and retried with backoff.

## Confidence bands

| Score | Level | Behavior |
|---|---|---|
| 0.95–1.00 | verified | Safe to auto-select |
| 0.80–0.94 | high | Auto-select OK |
| 0.60–0.79 | review | Show candidates |
| < 0.60 | low | Never auto-select |

## Provider trust

local 0.95 · restaurant 0.92 · usda 0.85 · nutritionix 0.80 · fatsecret 0.78 · custom (My Foods) 0.72 · off 0.50

User-submitted My Foods are ranked slightly below verified lab sources but
surface in their own **My Foods** search section and always win barcode
lookup when the scanned code matches.

## Audit

Run the live end-to-end checklist:

```bash
node scripts/audit-food-engine.mjs
```

Hits USDA DEMO_KEY + Open Food Facts, restaurant/local search, barcode
normalization, nutrition validation, dedupe, confidence, cache roundtrip,
image merge, conflict resolution, raw/cooked filtering, and scan/add route
wiring. Exits non-zero on any failure.
