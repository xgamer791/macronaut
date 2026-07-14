import { barcodeVariants } from './barcodeVariants';
import { NormalizedFood } from './normalize';

/** Safe data merging — combine the best image with the best-verified
 * nutrition ONLY when two results are clearly the same product. Never merges
 * unrelated foods that merely share words. Pure. */

function sameIdentity(a: NormalizedFood, b: NormalizedFood): boolean {
  if (a.barcode && b.barcode) {
    const av = new Set(barcodeVariants(a.barcode));
    if (barcodeVariants(b.barcode).some((v) => av.has(v))) return true;
  }
  const an = a.name.toLowerCase().trim();
  const bn = b.name.toLowerCase().trim();
  const ab = (a.brand ?? '').toLowerCase().trim();
  const bb = (b.brand ?? '').toLowerCase().trim();
  // Same brand + (one name contains the other) is a strong signal.
  if (ab && ab === bb && (an.includes(bn) || bn.includes(an))) return true;
  return false;
}

/**
 * Given a chosen best-nutrition food and other candidates for the same scan,
 * borrow a product image from a same-identity candidate if the chosen one has
 * none. Returns the (possibly image-enriched) food plus a note when merged.
 */
export function mergeBestImage(
  best: NormalizedFood,
  others: NormalizedFood[],
): { food: NormalizedFood; imageFrom?: string } {
  if (best.imageUrl) return { food: best };
  const donor = others.find((o) => o !== best && o.imageUrl && sameIdentity(best, o));
  if (!donor) return { food: best };
  return { food: { ...best, imageUrl: donor.imageUrl }, imageFrom: donor.provider };
}

/** True when two results independently agree on calories (±12%) — used to
 * mark a result as corroborated for confidence scoring. */
export function nutritionAgrees(a: NormalizedFood, b: NormalizedFood): boolean {
  const na = (a.perServing ?? a.per100g)?.calories;
  const nb = (b.perServing ?? b.per100g)?.calories;
  if (!na || !nb) return false;
  // Compare on a per-100g basis when possible so serving differences don't lie.
  const pa = a.per100g?.calories ?? na;
  const pb = b.per100g?.calories ?? nb;
  return Math.abs(pa - pb) / Math.max(pa, pb) <= 0.12;
}
