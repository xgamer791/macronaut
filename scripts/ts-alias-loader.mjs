/** Resolve `@/` → `src/` for Node --experimental-strip-types audit runs. */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcRoot = path.join(root, 'src');

function candidates(base) {
  const out = [];
  if (base.endsWith('.ts') || base.endsWith('.tsx') || base.endsWith('.js')) {
    out.push(base);
    return out;
  }
  out.push(`${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, 'index.ts'));
  return out;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const base = path.join(srcRoot, rel);
    for (const c of candidates(base)) {
      if (existsSync(c)) {
        return { shortCircuit: true, url: pathToFileURL(c).href };
      }
    }
    return { shortCircuit: true, url: pathToFileURL(`${base}.ts`).href };
  }
  // Allow extensionless relative imports of .ts files
  if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(new URL(context.parentURL).pathname);
    const base = path.resolve(parentDir, specifier);
    for (const c of candidates(base)) {
      if (existsSync(c)) {
        return { shortCircuit: true, url: pathToFileURL(c).href };
      }
    }
  }
  return nextResolve(specifier, context);
}
