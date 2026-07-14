/** ServingParserService — turns Open Food Facts' free-text serving fields
 * ("46 g (1/4 cup)", "1 bottle (355 ml)", "2 scoops (60 g)", "1 container
 * (170 g)") into a normalized {grams|ml, basis} so nutrition is never scaled
 * against the wrong reference. Pure and unit-tested. */

export type ServingBasis = 'serving' | '100g' | '100ml' | 'container' | 'unknown';

export interface ParsedServing {
  /** Serving mass in grams, when determinable. */
  grams?: number;
  /** Serving volume in millilitres, when the food is liquid. */
  ml?: number;
  /** What the per-serving nutrition actually describes. */
  basis: ServingBasis;
  /** True when the descriptor names a whole container/bottle/package. */
  isContainer: boolean;
  /** Cleaned label for display. */
  label?: string;
}

const FL_OZ_ML = 29.5735;
const OZ_G = 28.349523125;
const CUP_ML = 240;
const TBSP_ML = 15;
const TSP_ML = 5;

const CONTAINER_WORDS = /\b(container|bottle|carton|package|pack|can|jar|tub|pouch|box)\b/i;

function parseFraction(s: string): number | undefined {
  const m = s.trim().match(/^(\d+)?\s*(\d+)\/(\d+)$/);
  if (m) {
    const whole = m[1] ? Number(m[1]) : 0;
    return whole + Number(m[2]) / Number(m[3]);
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Extract the first "<qty> <unit>" of a target unit family from a string. */
function extract(str: string, units: RegExp): number | undefined {
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?|\\d*\\s*\\d+/\\d+)\\s*(${units.source})`, 'i');
  const m = str.match(re);
  if (!m) return undefined;
  return parseFraction(m[1].replace(',', '.'));
}

/**
 * Parse OFF serving fields. `servingSize` is the label string; `quantity`
 * and `unit` are OFF's parsed `serving_quantity` / `serving_quantity_unit`.
 */
export function parseServing(
  servingSize?: string,
  quantity?: number | string,
  unit?: string,
): ParsedServing {
  const label = servingSize?.trim() || undefined;
  const text = (label ?? '').toLowerCase();
  const isContainer = CONTAINER_WORDS.test(text);
  const q = typeof quantity === 'number' ? quantity : quantity ? Number(quantity) : undefined;
  const qUnit = unit?.toLowerCase();

  let grams: number | undefined;
  let ml: number | undefined;

  // 1) Trust OFF's structured serving_quantity + unit when present.
  if (q !== undefined && Number.isFinite(q) && q > 0) {
    if (qUnit === 'g' || qUnit === 'gram' || qUnit === 'grams') grams = q;
    else if (qUnit === 'ml' || qUnit === 'milliliter' || qUnit === 'millilitre') ml = q;
    else if (qUnit === 'oz') grams = q * OZ_G;
    else if (qUnit === 'fl oz' || qUnit === 'floz') ml = q * FL_OZ_ML;
  }

  // 2) Parse the label string for whatever the structured field missed.
  if (grams === undefined) {
    const g = extract(text, /g(?:rams?)?\b/);
    if (g !== undefined) grams = g;
  }
  if (ml === undefined) {
    const m = extract(text, /ml\b/);
    if (m !== undefined) ml = m;
    else {
      const floz = extract(text, /fl\.?\s*oz\b/);
      if (floz !== undefined) ml = floz * FL_OZ_ML;
    }
  }
  // Volume from common cooking units when nothing else gave ml.
  if (ml === undefined && grams === undefined) {
    const cup = extract(text, /cups?\b/);
    const tbsp = extract(text, /tbsp|tablespoons?\b/);
    const tsp = extract(text, /tsp|teaspoons?\b/);
    if (cup !== undefined) ml = cup * CUP_ML;
    else if (tbsp !== undefined) ml = tbsp * TBSP_ML;
    else if (tsp !== undefined) ml = tsp * TSP_ML;
  }
  // Bare oz (weight) as a last resort.
  if (grams === undefined && ml === undefined) {
    const oz = extract(text, /oz\b/);
    if (oz !== undefined) grams = oz * OZ_G;
  }

  const basis: ServingBasis = isContainer
    ? 'container'
    : grams !== undefined || ml !== undefined
      ? 'serving'
      : 'unknown';

  return { grams, ml, basis, isContainer, label };
}

/** Grams a serving is worth for density/validation (ml treated as grams). */
export function servingReferenceGrams(p: ParsedServing): number | undefined {
  return p.grams ?? p.ml;
}
