import { barcodeVariants, normalizeBarcode } from '../barcodeNormalize';

describe('normalizeBarcode', () => {
  it('strips non-digits', () => {
    expect(normalizeBarcode('30-1762-0422003').digits).toBe('3017620422003');
  });

  it('returns empty for blank input', () => {
    expect(normalizeBarcode('  ')).toEqual({ digits: '', canonical: null, format: 'empty' });
  });

  it('pads EAN-8 to GTIN-13', () => {
    const r = normalizeBarcode('12345670');
    expect(r.format).toBe('ean-8');
    expect(r.canonical).toBe('0000012345670');
  });

  it('pads UPC-A to EAN-13 with leading zero', () => {
    const r = normalizeBarcode('096619348656');
    expect(r.format).toBe('upc-a');
    expect(r.canonical).toBe('0096619348656');
  });

  it('keeps EAN-13 as canonical', () => {
    const r = normalizeBarcode('3017620422003');
    expect(r.format).toBe('ean-13');
    expect(r.canonical).toBe('3017620422003');
  });

  it('truncates GTIN-14 to GTIN-13', () => {
    const r = normalizeBarcode('03017620422003');
    expect(r.format).toBe('gtin-14');
    expect(r.canonical).toBe('3017620422003');
  });
});

describe('barcodeVariants', () => {
  it('generates common re-encodings for UPC-A', () => {
    expect(barcodeVariants('096619348656')).toEqual(
      expect.arrayContaining(['096619348656', '96619348656', '0096619348656']),
    );
    expect(barcodeVariants('0096619348656')).toEqual(expect.arrayContaining(['96619348656']));
  });

  it('includes EAN-8 pads', () => {
    const v = barcodeVariants('12345670');
    expect(v).toEqual(expect.arrayContaining(['12345670', '0000012345670']));
  });

  it('strips non-digits and handles empty input', () => {
    expect(barcodeVariants('  ')).toEqual([]);
    expect(barcodeVariants('30-1762-0422003')).toContain('3017620422003');
  });

  it('expands GTIN-14', () => {
    expect(barcodeVariants('03017620422003')).toEqual(
      expect.arrayContaining(['3017620422003', '03017620422003']),
    );
  });
});
