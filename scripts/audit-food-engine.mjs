#!/usr/bin/env node
/**
 * Production food-engine audit runner.
 *
 * Hits live USDA (DEMO_KEY) + Open Food Facts, exercises restaurant/local
 * search, barcode/nutrition/confidence/cache/conflict/prep pipelines, and
 * prints PASS/FAIL for each requirement. Exits non-zero on any failure.
 *
 * Usage: node scripts/audit-food-engine.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsPath = path.join(root, 'scripts', 'audit-food-engine-results.json');

console.log('═'.repeat(64));
console.log(' Macronaut food-engine audit');
console.log(' USDA DEMO_KEY + Open Food Facts + local pipeline');
console.log('═'.repeat(64));
console.log('');

if (fs.existsSync(resultsPath)) {
  try {
    fs.unlinkSync(resultsPath);
  } catch {
    /* ignore */
  }
}

const env = {
  ...process.env,
  EXPO_PUBLIC_USDA_API_KEY: process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY',
  FOOD_ENGINE_AUDIT: '1',
  FORCE_COLOR: '0',
};

const r = spawnSync(
  'npx',
  [
    'jest',
    'src/services/food/__tests__/foodEngineAudit.test.ts',
    '--runInBand',
    '--forceExit',
    '--verbose',
  ],
  {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  },
);

const combined = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
// Surface audit PASS/FAIL lines first for the checklist.
const auditLines = combined
  .split('\n')
  .filter((l) => /\[(PASS|FAIL)\]/.test(l) || /AUDIT FAIL/.test(l));
for (const line of auditLines) console.log(line);

if (!auditLines.length) {
  // Fallback: show jest tail if the suite crashed before logging.
  console.log(combined.slice(-4000));
}

console.log('');
console.log('─'.repeat(64));

let summary = null;
if (fs.existsSync(resultsPath)) {
  try {
    summary = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch {
    summary = null;
  }
}

if (summary?.results?.length) {
  const passed = summary.results.filter((x) => x.pass).length;
  const failed = summary.results.filter((x) => !x.pass).length;
  console.log(`Checklist: ${passed} PASS, ${failed} FAIL (${summary.results.length} checks)`);
  for (const row of summary.results) {
    console.log(`  ${row.pass ? 'PASS' : 'FAIL'}  ${row.name}`);
  }
} else {
  console.log('Checklist: (results file missing — suite may have crashed)');
}

const ok = r.status === 0 && summary?.passed !== false;
console.log('');
console.log(ok ? 'AUDIT RESULT: GREEN' : 'AUDIT RESULT: RED');
process.exit(ok ? 0 : 1);
