import fs from 'node:fs';
import path from 'node:path';
import {
  APPLE_HEALTH_DONE,
  APPLE_HEALTH_STATUS_UPDATED,
  APPLE_HEALTH_TODO,
} from '@/utils/appleHealthStatus';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('Apple Health pause note', () => {
  it('is a stack route so it can be opened without signing in', () => {
    expect(fs.existsSync(path.join(appDir, 'apple-health.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="apple-health"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'apple-health.tsx'))).toBe(false);
  });

  it('is linked from Settings', () => {
    expect(read(path.join('(tabs)', 'settings.tsx'))).toContain("router.push('/apple-health')");
    expect(read(path.join('(tabs)', 'settings.tsx'))).toContain('Apple Health and Watch');
  });

  it('renders the shared done and remaining lists', () => {
    const page = read('apple-health.tsx');
    expect(page).toContain('APPLE_HEALTH_DONE');
    expect(page).toContain('APPLE_HEALTH_TODO');
    expect(page).toContain('APPLE_HEALTH_STATUS_UPDATED');
    expect(APPLE_HEALTH_STATUS_UPDATED).toMatch(/^\d{1,2} \w+ \d{4}$/);
    expect(APPLE_HEALTH_DONE.length).toBeGreaterThanOrEqual(3);
    expect(APPLE_HEALTH_TODO.length).toBeGreaterThanOrEqual(4);
  });

  it('says HealthKit cannot run on the website', () => {
    const all = [...APPLE_HEALTH_DONE, ...APPLE_HEALTH_TODO].join(' ');
    expect(all.toLowerCase()).toMatch(/github pages|website/);
    expect(all.toLowerCase()).toContain('healthkit');
  });
});
