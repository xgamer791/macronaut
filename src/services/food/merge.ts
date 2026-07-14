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

/** Higher = more likely an official / manufacturer product shot. */
export function imageUrlQuality(url: string | undefined): number {
  if (!url) return -1;
  const u = url.toLowerCase();
  // Crowd-sourced OFF images are useful but weaker than manufacturer CDNs.
  if (u.includes('openfoodfacts')) return 1;
  if (/ferrero|nestle|kraft|pepsico|unilever|official/.test(u)) return 5;
  if (u.includes('nutritionix') || u.includes('nix-cdn') || u.includes('fatsecret')) return 4;
  if (u.includes('cloudinary') || u.includes('scene7') || u.includes('akamai')) return 3;
  if (u.includes('cdn.') || u.includes('/media/') || u.includes('product')) return 3;
  return 2;
}

/**
 * Given a chosen best-nutrition food and other candidates for the same scan,
 * borrow / upgrade a product image from a same-identity candidate.
 * Prefers manufacturer-like URLs over crowd-sourced Open Food Facts images.
 */
export function mergeBestImage(
  best: NormalizedFood,
  others: NormalizedFood[],
): { food: NormalizedFood; imageFrom?: string } {
  const donors = others.filter((o) => o !== best && o.imageUrl && sameIdentity(best, o));
  if (donors.length === 0) return { food: best };

  const ranked = [...donors].sort(
    (a, b) => imageUrlQuality(b.imageUrl) - imageUrlQuality(a.imageUrl),
  );
  const bestDonor = ranked[0];
  const currentQ = imageUrlQuality(best.imageUrl);
  const donorQ = imageUrlQuality(bestDonor.imageUrl);

  // Keep existing image unless a clearly better (manufacturer-like) donor exists.
  if (best.imageUrl && donorQ <= currentQ) return { food: best };
  if (!bestDonor.imageUrl) return { food: best };

  return {
    food: { ...best, imageUrl: bestDonor.imageUrl },
    imageFrom: bestDonor.provider,
  };
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
