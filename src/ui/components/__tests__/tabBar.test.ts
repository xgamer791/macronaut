import fs from 'node:fs';
import path from 'node:path';

const tabBar = fs.readFileSync(path.join(__dirname, '..', 'TabBar.tsx'), 'utf8');

describe('tab bar', () => {
  it('shows icons only — labels stay on the accessibility name', () => {
    expect(tabBar).toContain('accessibilityLabel={meta.label}');
    expect(tabBar).toContain('accessibilityLabel={`${meta.label}, coming soon`}');
    expect(tabBar).not.toContain('AppText');
    expect(tabBar).not.toContain('{meta.label}');
    expect(tabBar).toContain('size={24}');
  });
});
