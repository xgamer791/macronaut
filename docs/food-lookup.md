# Food lookup pipeline

All food lookup — barcode, search, and ingredient pickers — flows through one
centralized pipeline in `src/services/food/`. No lookup logic lives in UI
components. Every result is normalized to a single internal model, sanity-
checked, confidence-scored, cross-referenced across sources, and ranked before
it reaches the screen.

## Services

| Service | File | Responsibility |
|---|---|---|
| BarcodeLookupService / FoodSearchService | `foodSearchService.ts` | Orchestrates providers, dedupe, corroboration, ranking, caching. `search()` and `lookupBarcode()`. |
| NutritionNormalizationService | `normalize.ts` | Raw provider result → one `NormalizedFood` with explicit serving basis, resolved per-serving/per-100 g, validation, attribution. |
| ServingParserService | `servingParser.ts` | Parses OFF serving strings ("1 bottle (355 ml)", "2 scoops (60 g)") → grams/ml + basis (serving / 100 g / 100 ml / container). |
| NutritionValidationService | `nutritionValidation.ts` | Sanity checks: macro-mass vs serving, calorie↔macro (4/4/9), calorie density, protein plausibility (liquid-aware), fiber/sugar vs carbs, negatives. |
| FoodConfidenceService | `confidence.ts` | 0..1 score from source trust, barcode/brand/name match, completeness, validation, corroboration. `LOW_CONFIDENCE` gate. |
| merge | `merge.ts` | Safe same-identity image borrowing + per-100 g agreement detection. Never merges unrelated products. |
| WebFoodLookupService | `webFallback.ts` | Honest fallback: builds a targeted web search the user opens; no fabricated extraction client-side. |
| FoodCacheService | `foodRepo.ts` (`cached_foods`) | Stores source, confidence, serving basis, barcode, image, corrected flag. |

## Provider order & trust

1. Built-in verified generics (`genericFoods.ts`, verbatim USDA SR) — trust 0.95
2. USDA FoodData Central — trust 0.85
3. Open Food Facts (crowd-sourced) — trust 0.50
4. Local custom foods (barcode) — always win
5. Web-search fallback — user-driven, verified manually

Curated data outranks crowd-sourced. Providers are queried **in parallel**;
one failing never blocks the others.

## Barcode flow (`lookupBarcode`)

1. Normalize the code to all common re-encodings (UPC-A/EAN-13/leading zeros).
2. Return the user's custom food if one carries the barcode.
3. Serve the cache only if it scores ≥ `LOW_CONFIDENCE` and isn't flagged.
4. Query every provider × every variant in parallel.
5. Normalize + validate + confidence-score each hit.
6. Rank: **exact-barcode match first**, then confidence.
7. Borrow the best image from a same-identity result for the winner.
8. Return best + candidates + `lowConfidence`. Low confidence → the detail
   screen shows a review banner (edit / web search) before logging.

## Accuracy guarantees

- Nutrition is never scaled against the wrong basis: per-100 g is scaled by
  `gramsPerServing/100`; a provider's per-serving panel is used verbatim;
  liquids (ml) are distinguished from solids (g).
- Impossible panels (macros heavier than the serving, >9.3 kcal/g solids or
  >4.6 kcal/ml liquids, >90 g protein/100 g solids or >20 g/100 ml liquids,
  calorie↔macro mismatch >30%) collapse confidence and trigger a warning.
- Crowd-sourced single-source results can't reach high confidence without
  corroboration from a curated source.
- User corrections (edit → save as custom with the barcode) win on the next
  scan; flagged cache entries are re-queried live instead of reused.

Everything above is covered by `__tests__/accuracy.test.ts`,
`genericFoodsVerification.test.ts`, and `providers.test.ts`.
