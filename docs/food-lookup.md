# Food lookup pipeline

All food lookup — barcode, search, and ingredient pickers — flows through one
centralized pipeline in `src/services/food/`. No lookup logic lives in UI
components. Every result is normalized, validated, confidence-scored,
prep-filtered, conflict-resolved, ranked, and grouped before it reaches the
screen.

## Pipeline (search)

1. Local `cached_foods` (prioritize previously seen)
2. Bundled generics + official restaurant foods
3. Parallel providers: USDA, Nutritionix (if configured), FatSecret (if
   configured), Open Food Facts
4. Normalize → validate → confidence → meat prep filter → dedupe →
   conflict resolve (never average) → rank → group
5. Return flat `foods` (backward compat) + `groups` + optional `autoSelected`
   (only when confidence ≥ 0.80)

## Pipeline (barcode)

1. Normalize GTIN / UPC variants
2. Custom foods → confident cache
3. Parallel: Nutritionix → FatSecret → USDA branded → OFF (ordered, variants fan-out)
4. Rank → best match → cache

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

## Confidence bands

| Score | Level | Behavior |
|---|---|---|
| 0.95–1.00 | verified | Safe to auto-select |
| 0.80–0.94 | high | Auto-select OK |
| 0.60–0.79 | review | Show candidates |
| < 0.60 | low | Never auto-select |

## Provider trust

local 0.95 · restaurant 0.92 · usda 0.85 · nutritionix 0.80 · fatsecret 0.78 · off 0.50
