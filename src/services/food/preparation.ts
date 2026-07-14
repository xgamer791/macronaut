import { PreparationState } from './types';

/** PreparationState detection and meat-aware match rules.
 * Cooked meat searches must never match raw nutrition (and vice versa). */

const COOKED_STATES: ReadonlySet<PreparationState> = new Set([
  'cooked',
  'grilled',
  'roasted',
  'boiled',
  'pan_browned',
]);

const RAW_STATES: ReadonlySet<PreparationState> = new Set(['raw']);

const MEAT_PATTERN =
  /\b(chicken|beef|pork|turkey|lamb|veal|duck|goose|bison|venison|steak|chop|loin|brisket|ribs?|wing|thigh|drumstick|breast|ground\s*(beef|turkey|pork|chicken)|hamburger|sausage|bacon|ham|meat|fish|salmon|tuna|cod|tilapia|shrimp|prawn|crab|lobster|scallop|seafood)\b/i;

const PREP_PATTERNS: { state: PreparationState; re: RegExp }[] = [
  { state: 'ground_beef_ratio', re: /\b\d{2}\s*%\s*lean\b|\b(80|85|90|93|95)\s*\/\s*(20|15|10|7|5)\b|\blean\s*\/\s*fat\b/i },
  { state: 'lean_percent', re: /\b\d{2}\s*%\s*lean\b|\blean\b/i },
  { state: 'pan_browned', re: /\bpan[- ]?browned\b|\bbrowned\b|\bpan[- ]?fried\b/i },
  { state: 'grilled', re: /\bgrilled\b|\bbroiled\b/i },
  { state: 'roasted', re: /\broasted\b|\bbaked\b/i },
  { state: 'boiled', re: /\bboiled\b|\bpoached\b|\bstewed\b|\bsimmered\b/i },
  { state: 'drained', re: /\bdrained\b|\bcanned.*drained\b/i },
  { state: 'skinless', re: /\bskinless\b|\bwithout\s+skin\b|\bno\s+skin\b/i },
  { state: 'skin_on', re: /\bskin[- ]?on\b|\bwith\s+skin\b|\bskin\b(?!\s*less)/i },
  { state: 'raw', re: /\braw\b|\buncooked\b|\bfresh\b(?!.*cook)/i },
  { state: 'cooked', re: /\bcooked\b|\bprepared\b|\bheat(?:ed)?\b/i },
];

/** True when the text looks like a meat / seafood item. */
export function isMeatLike(text: string): boolean {
  return MEAT_PATTERN.test(text);
}

/** Detect preparation state from a food name or search query. */
export function detectPreparationState(text: string): PreparationState {
  const t = text.trim();
  if (!t) return 'unknown';
  for (const { state, re } of PREP_PATTERNS) {
    if (re.test(t)) return state;
  }
  return 'unknown';
}

function isCookedFamily(s: PreparationState): boolean {
  return COOKED_STATES.has(s);
}

function isRawFamily(s: PreparationState): boolean {
  return RAW_STATES.has(s);
}

/** Whether a query preparation is compatible with a food's preparation.
 * For meats: raw ↔ cooked family is never allowed. Exact matches preferred.
 * Non-meats: softer — unknown matches anything; skin/drain are soft. */
export function preparationMatches(
  queryState: PreparationState,
  foodState: PreparationState,
  opts: { meatLike?: boolean } = {},
): boolean {
  const meat = opts.meatLike ?? false;

  if (queryState === 'unknown' || foodState === 'unknown') {
    // Unknown query: allow anything. Unknown food: allow for non-meat;
    // for meat still allow (caller may prefer exact via ranking).
    return true;
  }

  if (queryState === foodState) return true;

  // Ground beef / lean percent are compatible with each other and raw/cooked
  // only when explicitly the same family isn't crossed for meats.
  if (
    (queryState === 'lean_percent' || queryState === 'ground_beef_ratio') &&
    (foodState === 'lean_percent' || foodState === 'ground_beef_ratio')
  ) {
    return true;
  }

  if (meat) {
    // Hard rule: never pair cooked searches with raw nutrition (or vice versa).
    if (isCookedFamily(queryState) && isRawFamily(foodState)) return false;
    if (isRawFamily(queryState) && isCookedFamily(foodState)) return false;

    // Cooked family members are soft-compatible with each other for meats.
    if (isCookedFamily(queryState) && isCookedFamily(foodState)) return true;

    // skin_on / skinless are orthogonal — compatible with raw/cooked if not crossing.
    if (
      (queryState === 'skin_on' || queryState === 'skinless') &&
      (foodState === 'skin_on' || foodState === 'skinless')
    ) {
      return queryState === foodState;
    }
    if (queryState === 'skin_on' || queryState === 'skinless') {
      return !isRawFamily(foodState) || queryState === foodState;
    }
    if (foodState === 'skin_on' || foodState === 'skinless') {
      return true; // query cooked/raw can still match skin variants of same family
    }
    if (queryState === 'drained' || foodState === 'drained') {
      return queryState === foodState;
    }
    return false;
  }

  // Non-meat: soft matching within cooked family; skin/drain exact preferred but allowed.
  if (isCookedFamily(queryState) && isCookedFamily(foodState)) return true;
  if (isCookedFamily(queryState) && isRawFamily(foodState)) return false;
  if (isRawFamily(queryState) && isCookedFamily(foodState)) return false;
  return true;
}

/** Preference score: 1 exact, 0.5 soft family match, 0 mismatch/unknown-unknown neutral. */
export function preparationMatchScore(
  queryState: PreparationState,
  foodState: PreparationState,
  opts: { meatLike?: boolean } = {},
): number {
  if (queryState === 'unknown') return 0.5;
  if (!preparationMatches(queryState, foodState, opts)) return 0;
  if (queryState === foodState) return 1;
  if (isCookedFamily(queryState) && isCookedFamily(foodState)) return 0.5;
  return 0.35;
}
