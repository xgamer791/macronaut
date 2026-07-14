/** Barcode / GTIN normalization for UPC-A, EAN-8, EAN-13, and GTIN variants.
 * Providers disagree on leading zeros and padding; we canonicalize when possible
 * and always expose the common re-encodings to try against each API. */

export interface NormalizedBarcode {
  /** Digits only, no padding changes. Empty when input had no digits. */
  digits: string;
  /** Canonical GTIN-13 when the input length allows a deterministic pad. */
  canonical: string | null;
  /** Format hint for the input (after digit strip). */
  format: 'ean-8' | 'upc-a' | 'ean-13' | 'gtin-14' | 'other' | 'empty';
}

function classify(digits: string): NormalizedBarcode['format'] {
  if (!digits) return 'empty';
  if (digits.length === 8) return 'ean-8';
  if (digits.length === 12) return 'upc-a';
  if (digits.length === 13) return 'ean-13';
  if (digits.length === 14) return 'gtin-14';
  return 'other';
}

/** Strip non-digits and produce a canonical GTIN-13 when possible.
 * - EAN-8 → pad left to 13
 * - UPC-A (12) → pad left with '0' to EAN-13
 * - EAN-13 → itself
 * - GTIN-14 → last 13 digits (drop packaging indicator)
 */
export function normalizeBarcode(code: string): NormalizedBarcode {
  const digits = code.replace(/\D/g, '');
  if (!digits) return { digits: '', canonical: null, format: 'empty' };

  const format = classify(digits);
  let canonical: string | null = null;
  switch (format) {
    case 'ean-8':
      canonical = digits.padStart(13, '0');
      break;
    case 'upc-a':
      canonical = digits.padStart(13, '0');
      break;
    case 'ean-13':
      canonical = digits;
      break;
    case 'gtin-14':
      canonical = digits.slice(1);
      break;
    default:
      if (digits.length < 13) canonical = digits.padStart(13, '0');
      break;
  }
  return { digits, canonical, format };
}

/** Common re-encodings to try against providers (UPC-A vs EAN-13, dropped
 * leading zeros, EAN-8 padded, GTIN-14 truncated). */
export function barcodeVariants(code: string): string[] {
  const { digits, canonical } = normalizeBarcode(code);
  const out = new Set<string>();
  if (!digits) return [];

  out.add(digits);
  if (canonical) out.add(canonical);

  const stripped = digits.replace(/^0+/, '');
  if (stripped) out.add(stripped);

  if (digits.length < 13) out.add(digits.padStart(13, '0'));
  if (digits.length < 12) out.add(digits.padStart(12, '0'));
  if (digits.length === 8) {
    // EAN-8 → EAN-13 and UPC-A-shaped pads
    out.add(digits.padStart(13, '0'));
    out.add(digits.padStart(12, '0'));
  }
  if (digits.length === 12) out.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith('0')) {
    out.add(digits.slice(1)); // UPC-A form
    const stripped13 = digits.replace(/^0+/, '');
    if (stripped13) out.add(stripped13);
  }
  if (digits.length === 14) {
    out.add(digits.slice(1));
    const inner = digits.slice(1);
    if (inner.startsWith('0')) out.add(inner.slice(1));
  }

  return [...out];
}
