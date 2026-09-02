#!/usr/bin/env node
// Checks that the Supabase project behind this build is ready to store diaries:
// every table the sync engine writes to exists, and none of them is readable
// without signing in.
//
//   node scripts/verify-sync.mjs
//
// Reads the same configuration the app does, so it verifies the project the
// shipped bundle actually points at.

import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../supabase.json', import.meta.url), 'utf8'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || config.url;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || config.anonKey;

if (!url || !key) {
  console.error('No Supabase project configured — this build runs local-only.');
  process.exit(1);
}

// This script is plain Node and cannot import the TypeScript source, so the
// list is duplicated. A test in src/services/sync/__tests__ fails if it drifts
// from SYNC_TABLES.
const TABLES = [
  'settings',
  'goal_configs',
  'day_type_marks',
  'meal_categories',
  'custom_foods',
  'diary_entries',
  'saved_meals',
  'saved_meal_items',
  'recipes',
  'recipe_ingredients',
  'food_log_history',
  'search_history',
  'favorites',
  'activity_entries',
  'day_notes',
];

async function probe(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();

  // 404 means the migration has not been applied.
  if (res.status === 404) return { state: 'missing' };
  // 401/403 is the correct answer for an anonymous caller: the table is there
  // and row-level security is refusing to hand rows to someone not signed in.
  if (res.status === 401 || res.status === 403) return { state: 'protected' };
  // A 200 with rows would mean anyone on the internet can read this table.
  if (res.ok) {
    const rows = JSON.parse(body);
    return rows.length === 0 ? { state: 'readable-but-empty' } : { state: 'exposed' };
  }
  return { state: 'error', detail: `HTTP ${res.status} ${body.slice(0, 120)}` };
}

const missing = [];
const exposed = [];
let ok = 0;

console.log(`project: ${url}\n`);

for (const table of TABLES) {
  const { state, detail } = await probe(table);
  if (state === 'protected') {
    ok++;
    console.log(`  ok        ${table}`);
  } else if (state === 'missing') {
    missing.push(table);
    console.log(`  MISSING   ${table}`);
  } else if (state === 'exposed') {
    exposed.push(table);
    console.log(`  EXPOSED   ${table}  <- readable without signing in`);
  } else if (state === 'readable-but-empty') {
    // Anonymous select returning an empty array rather than an error means the
    // grant is loose even though no data leaked yet.
    exposed.push(table);
    console.log(`  EXPOSED   ${table}  <- anonymous select is allowed`);
  } else {
    console.log(`  ?         ${table}  ${detail}`);
  }
}

console.log();

if (missing.length > 0) {
  console.error(`${missing.length} of ${TABLES.length} tables are missing.`);
  console.error('Run supabase/migrations/0002_sync_tables.sql in the Supabase SQL editor.');
  process.exit(1);
}

if (exposed.length > 0) {
  console.error(`${exposed.length} table(s) are readable without an account. Re-run 0002.`);
  process.exit(1);
}

console.log(`All ${ok} tables exist and refuse anonymous reads. Accounts are live.`);
