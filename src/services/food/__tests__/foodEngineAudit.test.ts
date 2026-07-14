/**
 * End-to-end production food-engine audit.
 * Invoked by scripts/audit-food-engine.mjs (FOOD_ENGINE_AUDIT=1).
 * Hits live USDA DEMO_KEY + Open Food Facts; exercises local pipeline modules.
 */
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodRepo } from '@/repositories/foodRepo';
import { barcodeVariants, normalizeBarcode } from '../barcodeNormalize';
import {
  AUTO_SELECT_CONFIDENCE,
  LOW_CONFIDENCE,
  SOURCE_TRUST,
  confidenceLevel,
  scoreConfidence,
} from '../confidence';
import { resolveConflicts } from '../conflict';
import { createFoodSearchService } from '../foodSearchService';
import { dedupeByIdentity } from '../grouping';
import { mergeBestImage } from '../merge';
import { normalizeFood } from '../normalize';
import { validateNutrition } from '../nutritionValidation';
import { offProvider } from '../openFoodFacts';
import { searchRestaurantFoods } from '../restaurantFoods';
import { searchGenericFoods } from '../genericFoods';
import { FoodProvider, ProviderFood, confidenceLevelFromScore } from '../types';
import { usdaProvider } from '../usda';
import * as fs from 'fs';
import * as path from 'path';

const results: { name: string; pass: boolean; evidence: string }[] = [];

function check(name: string, pass: boolean, evidence: string) {
  results.push({ name, pass, evidence });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name} — ${evidence}`);
  if (!pass) throw new Error(`AUDIT FAIL: ${name} — ${evidence}`);
}

function stub(
  id: FoodProvider['id'],
  search: ProviderFood[] = [],
  byCode: Record<string, ProviderFood> = {},
): FoodProvider {
  return {
    id,
    search: async () => search,
    getByBarcode: async (code) => byCode[code] ?? byCode[code.replace(/^0+/, '')] ?? null,
  };
}

const hasMacros = (f: ProviderFood | null | undefined) => {
  const n = f?.nutritionPer100g ?? f?.nutritionPerServing;
  return Boolean(n && n.calories > 0 && (n.protein !== undefined || n.carbs !== undefined || n.fat !== undefined));
};

const runLive = process.env.FOOD_ENGINE_AUDIT === '1';

(runLive ? describe : describe.skip)('food engine live audit', () => {
  jest.setTimeout(180_000);

  afterAll(() => {
    const out = path.join(process.cwd(), 'scripts', 'audit-food-engine-results.json');
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify({ results, passed: results.every((r) => r.pass) }, null, 2));
    } catch {
      /* ignore */
    }
  });

  it('1. USDA integration — oats / cooked chicken breast / ground beef', async () => {
    process.env.EXPO_PUBLIC_USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';

    for (const query of ['oats', 'cooked chicken breast', 'ground beef'] as const) {
      // Gentle pacing for DEMO_KEY burst limits.
      await new Promise((r) => setTimeout(r, 800));
      let foods;
      try {
        foods = await usdaProvider.search(query, { limit: 25 });
      } catch (err) {
        check(
          `USDA search "${query}" returns foods`,
          false,
          `error: ${(err as Error).message}`,
        );
        continue;
      }
      check(
        `USDA search "${query}" returns foods`,
        foods.length > 0,
        `${foods.length} results`,
      );
      const top =
        foods.find((f) => (f.nutritionPer100g?.calories ?? f.nutritionPerServing?.calories ?? 0) > 0) ??
        foods[0];
      check(
        `USDA "${query}" has nutrition`,
        hasMacros(top),
        `${top?.name} [${top?.dataType}] cal=${top?.nutritionPer100g?.calories ?? top?.nutritionPerServing?.calories}`,
      );
      // Foundation / SR priority: among non-branded filter results, first should not be Branded
      // when Foundation/SR exist in the page.
      const generics = foods.filter((f) => f.dataType && f.dataType !== 'Branded');
      if (generics.length > 0) {
        const firstGenericIdx = foods.findIndex((f) => f.dataType !== 'Branded');
        const firstBrandedIdx = foods.findIndex((f) => f.dataType === 'Branded');
        check(
          `USDA "${query}" Foundation/SR before Branded`,
          firstBrandedIdx === -1 || firstGenericIdx < firstBrandedIdx,
          `first generic idx=${firstGenericIdx} (${foods[firstGenericIdx]?.dataType}), first branded idx=${firstBrandedIdx}`,
        );
      } else {
        check(`USDA "${query}" has Foundation/SR/Survey hits`, false, 'no non-branded results');
      }
    }
  });

  it('2. Barcode lookup — OFF Nutella + USDA branded pipeline (mocked fallback)', async () => {
    const nutella = await offProvider.getByBarcode('3017624010701');
    check(
      'OFF barcode Nutella',
      Boolean(nutella && /nutella/i.test(nutella.name) && hasMacros(nutella)),
      nutella ? `${nutella.name} brand=${nutella.brand} cal=${nutella.nutritionPer100g?.calories}` : 'null',
    );

    // Live USDA branded is optional (DEMO_KEY flaky) — always exercise the pipeline with mocks.
    const repo = createFoodRepo(await createTestDb());
    const mockedUsda: ProviderFood = {
      provider: 'usda',
      id: 'branded-mock',
      name: 'Test Protein Bar',
      brand: 'Acme',
      barcode: '041631000652',
      isGeneric: false,
      category: 'packaged',
      dataType: 'Branded',
      nutritionPer100g: { calories: 400, protein: 25, carbs: 40, fat: 12 },
      nutritionPerServing: { calories: 200, protein: 12.5, carbs: 20, fat: 6 },
      gramsPerServing: 50,
    };
    const svc = createFoodSearchService(repo, [
      stub('usda', [], { '041631000652': mockedUsda, '0041631000652': mockedUsda }),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const pipe = await svc.lookupBarcode('041631000652');
    check(
      'USDA branded barcode via service pipeline',
      pipe.food?.id === 'branded-mock' && hasMacros(pipe.food),
      `id=${pipe.food?.id}`,
    );
  }, 60_000);

  it('3. Restaurant lookup — Big Mac / Chipotle chicken / Starbucks latte', () => {
    const cases: [string, RegExp][] = [
      ['Big Mac', /big mac/i],
      ['Chipotle chicken', /chipotle.*chicken|chicken/i],
      ['Starbucks latte', /latte/i],
    ];
    for (const [q, re] of cases) {
      const hits = searchRestaurantFoods(q);
      const top = hits[0];
      check(
        `restaurant "${q}"`,
        Boolean(
          top &&
            top.verified &&
            re.test(top.name) &&
            top.nutritionPerServing &&
            top.nutritionPerServing.calories > 0 &&
            top.nutritionPerServing.protein !== undefined,
        ),
        top
          ? `${top.name} P${top.nutritionPerServing?.protein}/C${top.nutritionPerServing?.carbs}/F${top.nutritionPerServing?.fat}`
          : 'no hits',
      );
    }
  });

  it('4. Search ranking / grouping — bestMatch, no chicken dump', async () => {
    const repo = createFoodRepo(await createTestDb());
    const chickenFlood: ProviderFood[] = Array.from({ length: 30 }, (_, i) => ({
      provider: 'usda' as const,
      id: `c${i}`,
      name: i % 2 === 0 ? 'Chicken breast, grilled' : `Chicken breast variant ${i}`,
      isGeneric: true,
      category: 'generic' as const,
      preparationState: 'grilled' as const,
      nutritionPer100g: { calories: 165 + (i % 3), protein: 31, carbs: 0, fat: 3.6 },
      gramsPerServing: 100,
    }));
    const svc = createFoodSearchService(repo, [
      stub('usda', chickenFlood),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const res = await svc.search('grilled chicken breast');
    check('groups.bestMatch present', Boolean(res.groups.bestMatch), res.groups.bestMatch?.name ?? 'null');
    const grilledSameName = res.groups.usdaWholeFoods.filter(
      (f) => f.name.toLowerCase() === 'chicken breast, grilled',
    );
    check(
      'no massive chicken duplicate dump',
      grilledSameName.length <= 1 && res.groups.usdaWholeFoods.length < 25,
      `same-name grilled=${grilledSameName.length}, usda bucket=${res.groups.usdaWholeFoods.length}, total foods=${res.foods.length}`,
    );
  });

  it('5. Barcode normalization — EAN-8 / EAN-13 / UPC-A / GTIN', () => {
    const ean8 = normalizeBarcode('12345670');
    check('EAN-8 → GTIN-13', ean8.format === 'ean-8' && ean8.canonical === '0000012345670', JSON.stringify(ean8));

    const ean13 = normalizeBarcode('3017624010701');
    check('EAN-13 canonical', ean13.format === 'ean-13' && ean13.canonical === '3017624010701', JSON.stringify(ean13));

    const upc = normalizeBarcode('096619348656');
    check('UPC-A → EAN-13', upc.format === 'upc-a' && upc.canonical === '0096619348656', JSON.stringify(upc));

    const gtin = normalizeBarcode('03017624010701');
    check('GTIN-14 → GTIN-13', gtin.format === 'gtin-14' && gtin.canonical === '3017624010701', JSON.stringify(gtin));

    const variants = barcodeVariants('096619348656');
    check(
      'barcode variants cover pads',
      variants.includes('096619348656') && variants.includes('0096619348656'),
      variants.join(','),
    );
  });

  it('6. Nutrition validation — impossible rejected; calorie≈P*4+C*4+F*9', () => {
    const good = validateNutrition({ calories: 165, protein: 31, carbs: 0, fat: 3.6 }, 100);
    check('sane panel ok', good.severity === 'ok', JSON.stringify(good));

    const impossible = validateNutrition({ calories: 1500, protein: 10, carbs: 10, fat: 10 }, 100);
    check(
      'impossible density rejected',
      impossible.severity === 'suspect' && impossible.warnings.includes('impossible-calorie-density'),
      JSON.stringify(impossible.warnings),
    );

    const mismatch = validateNutrition({ calories: 600, protein: 10, carbs: 20, fat: 3 }, 100);
    check(
      'calorie≈macros enforced',
      mismatch.warnings.includes('calorie-macro-mismatch') && (mismatch.macroCalorieDelta ?? 0) > 0.3,
      `delta=${mismatch.macroCalorieDelta}`,
    );

    const derived = 20 * 4 + 10 * 4 + 5 * 9; // 80+40+45 = 165
    const consistent = validateNutrition({ calories: 165, protein: 20, carbs: 10, fat: 5 }, 100);
    check(
      'calorie≈P*4+C*4+F*9',
      Math.abs(derived - 165) < 0.01 && consistent.severity === 'ok',
      `derived=${derived} severity=${consistent.severity}`,
    );
  });

  it('7. Duplicate detection', () => {
    const ranked = [
      {
        food: {
          provider: 'local' as const,
          id: 'a',
          name: 'Chicken breast, grilled',
          isGeneric: true,
          category: 'generic' as const,
          preparationState: 'grilled' as const,
        },
        score: 0.95,
        level: 'verified' as const,
        reasons: [],
        autoSelect: true,
      },
      {
        food: {
          provider: 'usda' as const,
          id: 'b',
          name: 'Chicken breast, grilled',
          isGeneric: true,
          category: 'generic' as const,
          preparationState: 'grilled' as const,
        },
        score: 0.9,
        level: 'high' as const,
        reasons: [],
        autoSelect: true,
      },
      {
        food: {
          provider: 'off' as const,
          id: 'c',
          name: 'Cola',
          barcode: '0123456789012',
          isGeneric: false,
        },
        score: 0.7,
        level: 'review' as const,
        reasons: [],
        autoSelect: false,
      },
      {
        food: {
          provider: 'usda' as const,
          id: 'd',
          name: 'Cola',
          barcode: '123456789012',
          isGeneric: false,
        },
        score: 0.6,
        level: 'review' as const,
        reasons: [],
        autoSelect: false,
      },
    ];
    const deduped = dedupeByIdentity(ranked);
    check('dedupe by identity', deduped.length === 2, `kept=${deduped.map((r) => r.food.id).join(',')}`);
  });

  it('8. Confidence scoring bands', () => {
    check('verified band', confidenceLevelFromScore(0.96) === 'verified', '0.96');
    check('high band', confidenceLevelFromScore(0.85) === 'high', '0.85');
    check('review band', confidenceLevelFromScore(0.7) === 'review', '0.7');
    check('low band', confidenceLevelFromScore(0.4) === 'low', '0.4');
    check('thresholds', LOW_CONFIDENCE === 0.6 && AUTO_SELECT_CONFIDENCE === 0.8, '0.6/0.8');
    check('trust order', SOURCE_TRUST.local > SOURCE_TRUST.usda && SOURCE_TRUST.usda > SOURCE_TRUST.off, JSON.stringify(SOURCE_TRUST));

    const nf = normalizeFood({
      provider: 'usda',
      id: '1',
      name: 'Oats',
      isGeneric: true,
      nutritionPer100g: { calories: 389, protein: 17, carbs: 66, fat: 7 },
      gramsPerServing: 100,
    });
    const scored = scoreConfidence(nf);
    check('confidenceLevel helper', confidenceLevel(scored.score) === scored.level, scored.level);
  });

  it('9. Caching — upsert + findCachedByBarcode roundtrip', async () => {
    const repo = createFoodRepo(await createTestDb());
    await repo.upsertCachedFood({
      provider: 'off',
      providerId: '3017624010701',
      name: 'Nutella',
      brand: 'Ferrero',
      barcode: '3017624010701',
      nutritionPer100g: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
      gramsPerServing: 15,
      confidence: 0.75,
      cachedAt: new Date().toISOString(),
      flagged: false,
    });
    const hit = await repo.findCachedByBarcode('3017624010701');
    check(
      'cache roundtrip',
      hit?.name === 'Nutella' && hit.providerId === '3017624010701',
      hit ? `${hit.name} conf=${hit.confidence}` : 'miss',
    );
  });

  it('10. Image retrieval — OFF Nutella + mergeBestImage manufacturer preference', async () => {
    const nutella = await offProvider.getByBarcode('3017624010701');
    check(
      'OFF Nutella image',
      Boolean(nutella?.imageUrl && /^https?:\/\//.test(nutella.imageUrl)),
      nutella?.imageUrl ?? 'none',
    );

    const best = normalizeFood({
      provider: 'usda',
      id: 'u',
      name: 'Nutella',
      brand: 'Ferrero',
      barcode: '3017624010701',
      isGeneric: false,
      nutritionPer100g: { calories: 539, protein: 6, carbs: 58, fat: 31 },
      gramsPerServing: 15,
    });
    const offImg = normalizeFood({
      provider: 'off',
      id: 'o',
      name: 'Nutella',
      brand: 'Ferrero',
      barcode: '3017624010701',
      isGeneric: false,
      imageUrl: 'https://images.openfoodfacts.org/images/products/301/762/401/0701/front.jpg',
      nutritionPer100g: { calories: 539, protein: 6, carbs: 58, fat: 31 },
      gramsPerServing: 15,
    });
    const mfrImg = normalizeFood({
      provider: 'nutritionix',
      id: 'n',
      name: 'Nutella',
      brand: 'Ferrero',
      barcode: '3017624010701',
      isGeneric: false,
      imageUrl: 'https://nutritionix.com/media/nutella-official.png',
      nutritionPer100g: { calories: 539, protein: 6, carbs: 58, fat: 31 },
      gramsPerServing: 15,
    });
    const merged = mergeBestImage(best, [best, offImg, mfrImg]);
    check(
      'mergeBestImage prefers manufacturer-like URL',
      Boolean(merged.food.imageUrl && !/openfoodfacts/i.test(merged.food.imageUrl)),
      `${merged.food.imageUrl} from=${merged.imageFrom}`,
    );
  });

  it('11. Conflict resolution — never averages; USDA wins generic', () => {
    const a: ProviderFood = {
      provider: 'usda',
      id: 'u',
      name: 'Chicken breast',
      isGeneric: true,
      category: 'generic',
      nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    };
    const b: ProviderFood = {
      provider: 'off',
      id: 'o',
      name: 'Chicken breast',
      isGeneric: true,
      category: 'generic',
      brand: 'Crowd',
      nutritionPer100g: { calories: 300, protein: 20, carbs: 10, fat: 15 },
    };
    const result = resolveConflicts([{ food: a }, { food: b }]);
    check('USDA wins generic', result?.winner.provider === 'usda', result?.winner.provider ?? 'null');
    check(
      'never averages',
      result?.winner.nutritionPer100g?.calories === 165,
      `winner cal=${result?.winner.nutritionPer100g?.calories}`,
    );
  });

  it('12. Raw vs cooked — best match respects prep', async () => {
    const repo = createFoodRepo(await createTestDb());
    const raw: ProviderFood = {
      provider: 'usda',
      id: 'raw',
      name: 'Chicken breast, raw',
      isGeneric: true,
      category: 'generic',
      preparationState: 'raw',
      nutritionPer100g: { calories: 120, protein: 22, carbs: 0, fat: 3 },
      gramsPerServing: 100,
    };
    const cooked: ProviderFood = {
      provider: 'usda',
      id: 'cooked',
      name: 'Chicken breast, cooked',
      isGeneric: true,
      category: 'generic',
      preparationState: 'cooked',
      nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      gramsPerServing: 100,
    };
    const svc = createFoodSearchService(repo, [
      stub('usda', [raw, cooked]),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);

    const cookedQ = await svc.search('cooked chicken breast');
    const cookedHasRaw = cookedQ.foods.some(
      (f) =>
        f.id === 'raw' ||
        f.preparationState === 'raw' ||
        (/\braw\b/i.test(f.name) && !/\bcooked|grilled|roasted|braised|baked\b/i.test(f.name)),
    );
    check(
      'cooked query does not best-match raw',
      cookedQ.groups.bestMatch?.preparationState !== 'raw' &&
        cookedQ.groups.bestMatch?.id !== 'raw' &&
        !cookedHasRaw,
      `best=${cookedQ.groups.bestMatch?.name} prep=${cookedQ.groups.bestMatch?.preparationState} ids=${cookedQ.foods.map((f) => f.id).join(',')}`,
    );

    const rawQ = await svc.search('raw chicken breast');
    const rawHasCooked = rawQ.foods.some(
      (f) =>
        f.id === 'cooked' ||
        (f.preparationState !== undefined &&
          ['cooked', 'grilled', 'roasted', 'boiled', 'pan_browned'].includes(f.preparationState)),
    );
    check(
      'raw query does not prefer cooked',
      rawQ.groups.bestMatch?.preparationState !== 'cooked' &&
        rawQ.groups.bestMatch?.id !== 'cooked' &&
        !['cooked', 'grilled', 'roasted', 'boiled', 'pan_browned'].includes(
          rawQ.groups.bestMatch?.preparationState ?? '',
        ) &&
        !rawHasCooked,
      `best=${rawQ.groups.bestMatch?.name} prep=${rawQ.groups.bestMatch?.preparationState} ids=${rawQ.foods.map((f) => f.id).join(',')}`,
    );
  });

  it('13. Generic / packaged / restaurant accuracy smoke', async () => {
    const generics = searchGenericFoods('chicken breast');
    check('generic chicken breast', generics.length > 0 && hasMacros(generics[0]), generics[0]?.name ?? 'none');

    const rest = searchRestaurantFoods('Big Mac');
    check('restaurant Big Mac macros', hasMacros(rest[0]) && rest[0].verified === true, rest[0]?.name ?? 'none');

    const repo = createFoodRepo(await createTestDb());
    const packaged: ProviderFood = {
      provider: 'off',
      id: 'p',
      name: 'Greek Yogurt',
      brand: 'Fage',
      isGeneric: false,
      category: 'packaged',
      barcode: '689544000012',
      nutritionPerServing: { calories: 150, protein: 20, carbs: 9, fat: 4 },
      gramsPerServing: 227,
    };
    const svc = createFoodSearchService(repo, [
      stub('usda'),
      stub('off', [packaged]),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const res = await svc.search('fage greek yogurt');
    check(
      'packaged searchable',
      res.foods.some((f) => f.id === 'p') || res.groups.packagedFoods.some((f) => f.id === 'p'),
      `foods=${res.foods.length} packaged=${res.groups.packagedFoods.length}`,
    );
  });

  it('14. No TODO/FIXME/placeholder unfinished code in src/services/food/', () => {
    const dir = path.join(process.cwd(), 'src', 'services', 'food');
    const bad: string[] = [];
    const re = /TODO|FIXME|placeholder|not implemented|Not implemented/i;
    function walk(d: string) {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        if (ent.name === '__tests__') continue;
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js)$/.test(ent.name)) {
          const text = fs.readFileSync(p, 'utf8');
          for (const [i, line] of text.split('\n').entries()) {
            if (re.test(line)) bad.push(`${path.relative(process.cwd(), p)}:${i + 1}:${line.trim()}`);
          }
        }
      }
    }
    walk(dir);
    check('no unfinished markers', bad.length === 0, bad.length ? bad.join(' | ') : 'clean');
  });

  it('15. Scan UI / add.tsx conceptual routes for restaurant + custom', () => {
    const scan = fs.readFileSync(path.join(process.cwd(), 'src/app/scan.tsx'), 'utf8');
    const add = fs.readFileSync(path.join(process.cwd(), 'src/app/add.tsx'), 'utf8');
    const detail = fs.readFileSync(path.join(process.cwd(), 'src/app/food/[provider]/[id].tsx'), 'utf8');

    check(
      'scan routes to /food/[provider]/[id]',
      scan.includes("pathname: '/food/[provider]/[id]'") && scan.includes('lookupBarcode'),
      'scan uses provider detail route',
    );
    check(
      'add.tsx opens provider detail including restaurant',
      add.includes("pathname: '/food/[provider]/[id]'") && add.includes('restaurant'),
      'add search → provider route',
    );
    check(
      'detail handles restaurant + custom',
      detail.includes("provider === 'restaurant'") && detail.includes("provider === 'custom'"),
      'restaurant/custom branches present',
    );
  });
});
