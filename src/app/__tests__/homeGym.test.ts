import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const rootDir = path.join(appDir, '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8');

/** Everything under src/, so a leaked key would be found wherever it hid. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('home gym', () => {
  const picker = read('src', 'ui', 'components', 'HomeGymPicker.tsx');
  const route = read('src', 'app', 'home-gym.tsx');
  const layout = read('src', 'app', '_layout.tsx');
  const settings = read('src', 'app', '(tabs)', 'settings.tsx');
  const profile = read('src', 'app', 'profile.tsx');
  const header = read('src', 'ui', 'components', 'ProfileHeader.tsx');
  const config = read('app.config.ts');

  it('is a slide-over route reachable from Settings and the profile', () => {
    expect(fs.existsSync(path.join(appDir, 'home-gym.tsx'))).toBe(true);
    expect(layout).toContain('<Stack.Screen name="home-gym" options={SLIDE_OVER_OPTIONS} />');
    expect(route).toContain('<SlideScreen from="right">');
    expect(route).toContain('<ScreenHeader title="Home gym" />');
    expect(route).toContain('<HomeGymPicker');
    expect(settings).toContain('title="Home gym"');
    expect(settings).toContain("router.push('/home-gym')");
    expect(settings).toContain('useMyGym');
    expect(profile).toContain('label="Home gym"');
    expect(profile).toContain("router.push('/home-gym')");
  });

  it('anchors on the phone or a typed address, then searches only on submit', () => {
    expect(picker).toContain("import * as Location from 'expo-location';");
    expect(picker).toContain('requestForegroundPermissionsAsync');
    expect(picker).toContain('getCurrentPositionAsync');
    expect(picker).toContain('accessibilityLabel="Use my location"');
    expect(picker).toContain('A rough address or city');
    expect(picker).toContain('within 7 miles');
    expect(picker).toContain("anchor?.label === 'Your location'");
    expect(picker).toContain('friendlyActionError');
    // Paid requests fire from a button or the keyboard's search key, never per keystroke.
    expect(picker).toContain('onSubmitEditing={() => void runSearch()}');
    expect(picker).not.toContain('useDebounced');
    expect(picker).not.toContain('useEffect');
  });

  it('offers the group as a default-on choice and ships dark without a key', () => {
    expect(picker).toContain('useState(true)');
    expect(picker).toContain('accessibilityRole="switch"');
    expect(picker).toContain('Join the ${selected.name} group');
    expect(picker).toContain('useGymSearchAvailable');
    expect(picker).toContain('Gym search isn’t set up yet');
    expect(picker).toContain('Skip for now');
  });

  it('asks for location only when in use, and only for this', () => {
    expect(config).toContain("'expo-location'");
    expect(config).toContain('locationWhenInUsePermission');
    expect(read('package.json')).toContain('"expo-location"');
  });

  it('shows the gym on the profile without the header strings its tests forbid', () => {
    expect(header).toContain('profile.homeGym');
    expect(header).toContain('Trains at');
    expect(header).not.toContain('barbell');
  });

  it('keeps the places key out of the bundle', () => {
    const own = path.join(appDir, '__tests__', 'homeGym.test.ts');
    for (const file of walk(path.join(rootDir, 'src'))) {
      if (file === own) continue;
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/EXPO_PUBLIC_[A-Z_]*(GOOGLE|PLACES|MAPS)/);
      expect(source).not.toContain('GOOGLE_PLACES_API_KEY');
    }
    expect(read('convex', 'places.ts')).toContain('process.env.GOOGLE_PLACES_API_KEY');
  });
});
