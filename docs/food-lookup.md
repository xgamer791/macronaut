# Food lookup pipeline

All food lookup — barcode, search, and ingredient pickers — flows through one
centralized pipeline in `src/services/food/`. No lookup logic lives in UI
components. Every result is normalized to a single internal food model, sanity-
checked, confidence-scored, conflict-resolved, ranked, and grouped before it
reaches the screen.

## Services

| Service | File | Responsibility |
|---|---|---|
| BarcodeLookupService / FoodSearchService | `foodSearchService.ts` | Orchestrates providers, dedupe, corroboration, ranking, caching. `search()` and `lookupBarcode()`. |
| NutritionNormalizationService | `normalize.ts` | Raw provider result → one `NormalizedFood` with serving basis, prep state, validation, attribution. |
| ServingParserService | `servingParser.ts` | Parses OFF serving strings → grams/ml + basis. |
| NutritionValidationService | `nutritionValidation.ts` | Sanity checks: negatives, missing calories/macros, macro-mass vs serving, calorie↔macro (4/4/9), density, protein plausibility. Large mismatches → suspect (no auto-approve). |
| FoodConfidenceService | `confidence.ts` | 0..1 score from source trust (incl. restaurant / Nutritionix / FatSecret), barcode/brand/name, prep match, completeness, validation, corroboration. Bands via `confidenceLevel`. |
| httpClient | `httpClient.ts` | Shared fetch: retries (429/5xx/network), timeout, AbortSignal, User-Agent, per-host rate limit. |
| barcodeNormalize | `barcodeNormalize.ts` | UPC-A / EAN-8 / EAN-13 / GTIN-14 → canonical GTIN-13 + variant fan-out. |
| preparation | `preparation.ts` | Detect raw/cooked/grill/…; meat-aware match (never raw↔cooked for meats). |
| conflict | `conflict.ts` | Never-average resolution: branded packaged, official restaurant, USDA generic, barcode > text, newest verified. |
| ranking | `ranking.ts` | Pure score; auto-select ≥ 0.80; never auto-select < 0.60. |
| grouping | `grouping.ts` | `bestMatch` / USDA whole foods / packaged / restaurant / my foods; identity dedupe. |
| internalFood | `internalFood.ts` | `InternalFood` schema + `toInternalFood()` converter. |
| merge | `merge.ts` | Safe same-identity image borrowing + per-100 g agreement. |
| WebFoodLookupService | `webFallback.ts` | Honest web-search fallback; no fabricated extraction. |
| FoodCacheService | `foodRepo.ts` (`cached_foods`) | Stores source, confidence, prep, restaurant, ingredients, allergens, verified, category, serving basis. |

## Provider order & trust

1. Built-in verified generics (`local`) — trust 0.95
2. Official restaurant menus (`restaurant`) — trust ~0.92
3. USDA FoodData Central — trust 0.85
4. Nutritionix — trust ~0.80
5. FatSecret — trust ~0.78
6. Open Food Facts — trust 0.50
7. Local custom foods (barcode) — always win
8. Web-search fallback — user-driven

Providers are queried **in parallel**; one failing never blocks the others.

## Confidence bands

| Score | Level | Behavior |
|---|---|---|
| 0.95–1.00 | verified | Safe to auto-select |
| 0.80–0.94 | high | Auto-select OK |
| 0.60–0.79 | review | Show candidates / ask to confirm |
| < 0.60 | low | Never auto-select |

## Barcode flow (`lookupBarcode`)

1. Normalize to GTIN-13 when possible; fan out UPC/EAN variants.
2. Return the user's custom food if one carries the barcode.
3. Serve the cache only if it scores ≥ `LOW_CONFIDENCE` (0.60) and isn't flagged.
4. Query every provider × every variant in parallel (via `httpClient`).
5. Normalize + validate + confidence-score each hit.
6. Rank: **exact-barcode match first**, then confidence; resolve conflicts without averaging.
7. Borrow the best image from a same-identity result for the winner.
8. Return best + candidates + `lowConfidence`.

Everything above is covered by `__tests__/` (accuracy, barcodeNormalize,
preparation, conflict, ranking, grouping, internalFood, httpClient, confidence,
providers, generic verification).
