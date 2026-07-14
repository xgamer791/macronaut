/** Barcode formats vary (UPC-A vs EAN-13, dropped leading zeros). Given a
 * scanned code, return the common re-encodings to try against providers. */
export function barcodeVariants(code: string): string[] {
  const raw = code.replace(/\D/g, '');
  const out = new Set<string>();
  if (!raw) return [];
  out.add(raw);
  const stripped = raw.replace(/^0+/, '');
  if (stripped) out.add(stripped);
  if (raw.length < 13) out.add(raw.padStart(13, '0'));
  if (raw.length < 12) out.add(raw.padStart(12, '0'));
  if (raw.length === 13 && raw.startsWith('0')) out.add(raw.slice(1));
  return [...out];
}
