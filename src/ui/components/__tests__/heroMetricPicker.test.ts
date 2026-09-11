import fs from 'node:fs';
import path from 'node:path';

const picker = fs.readFileSync(path.join(__dirname, '..', 'HeroMetricPicker.tsx'), 'utf8');
const today = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'app', '(tabs)', 'index.tsx'),
  'utf8',
);

describe('homepage module picker', () => {
  it('uses a compact card grid with a clear radio selection', () => {
    expect(today).not.toContain('<HeroMetricPicker');
    expect(today).not.toContain('Each module uses a layout optimized');
    expect(picker).toContain('<Sheet');
    expect(picker).toContain('Customize ${slot} module');
    expect(picker).toContain('Choose what you want to track');
    expect(picker).toContain('accessibilityRole="radiogroup"');
    expect(picker).toContain('accessibilityRole="radio"');
    expect(picker).toContain('accessibilityState={{ selected: isSelected }}');
    expect(picker).toContain('name="checkmark"');
    expect(picker).toContain("flexWrap: 'wrap'");
    expect(picker).toContain("width: '48%'");
  });

  it('uses app theme surfaces and identifies a metric already on the other module', () => {
    expect(picker).toContain('backgroundColor: colors.surfaceRaised');
    expect(picker).toContain('borderColor: isSelected ? colors.accent : colors.border');
    expect(picker).toContain('usedElsewhere && !isSelected');
    expect(picker).toContain('{otherSlot.toUpperCase()}');
    expect(picker).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('closes immediately after a valid choice and keeps the existing sheet transition', () => {
    expect(picker).toContain('void Haptics.selectionAsync()');
    expect(picker).toContain('onClose={onClose}');
    expect(picker).toContain('onSelect(metric.id)');
  });
});
