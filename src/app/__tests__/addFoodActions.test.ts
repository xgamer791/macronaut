import fs from 'node:fs';
import path from 'node:path';

const add = fs.readFileSync(path.join(__dirname, '..', 'add.tsx'), 'utf8');
const search = add.split('{/* Full-width food search */}')[1].split('{/* Underline tabs */}')[0];
const quickActions = add.split('<QuickTileRow>')[1].split('</QuickTileRow>')[0];

describe('Add food actions', () => {
  it('uses a full-width search field without a barcode button beside it', () => {
    expect(search).toContain('styles.searchPill');
    expect(search).not.toContain('barcode-outline');
    expect(search).not.toContain("router.push('/scan')");
    expect(add).toContain("width: '100%'");
    expect(add).not.toContain('styles.barcodeBtn');
  });

  it('orders the four action tiles from barcode scanner through quick add', () => {
    const labels = ['Barcode scanner', 'Voice log', 'AI food scan', 'Quick add'];
    const positions = labels.map((label) => quickActions.indexOf(`label="${label}"`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(quickActions).not.toContain('label="Custom food"');
    expect(quickActions).toContain("onPress={() => router.push('/scan')}");
  });

  it('shows Voice log as an inoperative placeholder', () => {
    expect(quickActions).toContain(
      '<QuickTile icon="mic-outline" label="Voice log" disabled onPress={() => undefined} />',
    );
  });
});
