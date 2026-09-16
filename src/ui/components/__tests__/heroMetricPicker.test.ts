import fs from 'node:fs';
import path from 'node:path';

const picker = fs.readFileSync(path.join(__dirname, '..', 'HeroMetricPicker.tsx'), 'utf8');
const today = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'app', '(tabs)', 'index.tsx'),
  'utf8',
);

describe('homepage module picker', () => {
  it('uses a compact card grid with a clear radio selection', () => {
    expect(today).toContain('<HeroMetricPicker');
    expect(today).not.toContain('Each module uses a layout optimized');
    expect(picker).toContain('<Modal');
    expect(picker).toContain('Customize {side} module');
    expect(picker).toContain('Choose what you want to track');
    expect(picker).toContain('accessibilityRole="radiogroup"');
    expect(picker).toContain('accessibilityRole="radio"');
    expect(picker).toContain('accessibilityState={{ selected: isSelected }}');
    expect(picker).toContain('name="checkmark"');
    expect(picker).toContain("flexWrap: 'wrap'");
    expect(picker).toContain("width: '48%'");
  });

  it('opens each picker from its own edge on the hamburger timing curve', () => {
    expect(picker).toContain("const direction = side === 'left' ? -1 : 1");
    expect(picker).toContain(
      "usePushWhileOpen(open, { x: side === 'left' ? panelWidth : -panelWidth })",
    );
    expect(picker).toContain('SLIDE_DURATION_MS');
    expect(picker).toContain('SLIDE_EASING');
    expect(picker).toContain('dataSet: { moduledrawer: side }');
    expect(picker).toContain("side === 'left' ? styles.drawerLeft : styles.drawerRight");
    expect(picker).not.toContain("from './Sheet'");
  });

  it('uses app theme surfaces and identifies a metric already on the other module', () => {
    expect(picker).toContain('backgroundColor: colors.surfaceRaised');
    expect(picker).toContain('borderColor: isSelected ? colors.accent : colors.border');
    expect(picker).toContain('usedElsewhere && !isSelected');
    expect(picker).toContain('{otherSlot.toUpperCase()}');
    expect(picker).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('closes immediately after a valid choice and keeps the directional transition', () => {
    const close = today.indexOf('setPickerSlot(null);');
    const save = today.indexOf('await settings.set(key, id);');
    expect(close).toBeGreaterThan(-1);
    expect(close).toBeLessThan(save);
    expect(picker).toContain('void Haptics.selectionAsync()');
  });

  it('offers a live fasting module backed by the existing fasting state', () => {
    expect(today).toContain('useFastingState');
    expect(today).toContain("case 'fasting'");
    expect(picker).toContain("fasting: 'Live timer'");
  });
});
