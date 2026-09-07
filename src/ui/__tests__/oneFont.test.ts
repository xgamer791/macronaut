import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Macronaut is set in one face. These pin the three places that decide it:
 * what is loaded, what the tokens name, and how a weight becomes a family. */
describe('one font', () => {
  it('loads Inter, at every weight the app uses, before anything renders', () => {
    const layout = read('src', 'app', '_layout.tsx');
    // Each weight from its own file, never the barrel: the barrel would ship
    // all eighteen faces, italics and hairlines included.
    expect(layout).not.toContain("from '@expo-google-fonts/inter'");
    for (const face of ['400Regular', '500Medium', '600SemiBold', '700Bold']) {
      expect(layout).toContain(`require('@expo-google-fonts/inter/${face}/Inter_${face}.ttf')`);
    }
    expect(layout).toContain('if (!fontsLoaded || !mounted) return null;');
    expect(read('package.json')).toContain('"@expo-google-fonts/inter"');
    expect(read('package.json')).not.toContain('space-grotesk');
  });

  it('names no other face anywhere', () => {
    for (const file of sourceFiles(path.join(root, 'src'))) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/SpaceGrotesk|space-grotesk/);
      // Every family named in source is one of Inter's four weights.
      for (const family of text.match(/fontFamily:\s*'([^']+)'/g) ?? []) {
        expect(family).toMatch(/Inter_(400Regular|500Medium|600SemiBold|700Bold)/);
      }
    }
  });

  it('expresses weight as a family, never as fontWeight on a loaded face', () => {
    const tokens = read('src', 'ui', 'theme', 'tokens.ts');
    expect(tokens).toContain('export function fontFor');
    // Every size carries the face, so an input spreading a size is set in it.
    for (const size of ['hero', 'title', 'heading', 'body', 'caption', 'micro']) {
      expect(tokens).toMatch(new RegExp(`${size}: \\{ fontFamily: fonts\\.regular`));
    }
    const appText = read('src', 'ui', 'components', 'AppText.tsx');
    expect(appText).toContain('fontFor(asked)');
    // The weight is consumed here and dropped: it must never reach <Text>.
    expect(appText).toContain('const { fontWeight: _dropped, ...rest_style } = flat;');
    expect(appText).not.toMatch(/\{ fontWeight: weight \}/);
  });

  it('sets every text input in the face too, since inputs bypass AppText', () => {
    const inputs = sourceFiles(path.join(root, 'src')).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('<TextInput'),
    );
    expect(inputs.length).toBeGreaterThan(0);
    for (const file of inputs) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).toMatch(/fontFamily: fonts\.|\.\.\.type\.|\btype\.(body|caption)\b/);
    }
  });
});
