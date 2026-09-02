#!/usr/bin/env node
/**
 * Resolves the Supabase config the web build will compile in, and prints it as
 * KEY=VALUE lines the deploy workflow appends to $GITHUB_ENV.
 *
 * Mirrors src/services/supabase/config.ts: an EXPO_PUBLIC_* environment
 * variable wins over the committed supabase.json, and a source that supplies
 * only half a pair is an error rather than something to complete from the
 * other source. Kept separate because CI needs the answer before the bundler
 * runs, in order to check afterwards that the bundle really contains it.
 *
 * Only the mode and host are printed — never the credentials, which the
 * bundler reads for itself.
 *
 * Usage: node scripts/supabase-config.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const trim = (value) => String(value ?? '').trim();

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function readFileConfig() {
  const file = path.join(root, 'supabase.json');
  if (!fs.existsSync(file)) return { url: '', anonKey: '' };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { url: trim(parsed.url), anonKey: trim(parsed.anonKey) };
  } catch (err) {
    fail(`supabase.json is not valid JSON: ${err.message}`);
  }
}

function jwtPayload(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return '';
  try {
    return Buffer.from(parts[1], 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function isPrivilegedKey(key) {
  return key.startsWith('sb_secret_') || /"role"\s*:\s*"service_role"/.test(jwtPayload(key));
}

const file = readFileConfig();
const sources = [
  {
    name: 'the EXPO_PUBLIC_SUPABASE_* environment',
    url: trim(process.env.EXPO_PUBLIC_SUPABASE_URL),
    anonKey: trim(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  },
  { name: 'supabase.json', url: file.url, anonKey: file.anonKey },
];

const chosen = sources.find((source) => source.url || source.anonKey);

if (!chosen) {
  console.log('MACRONAUT_AUTH_MODE=local-only');
  console.log('MACRONAUT_SUPABASE_HOST=');
  process.exit(0);
}

if (!chosen.url || !chosen.anonKey) {
  fail(
    `${chosen.name} sets only one of url/anonKey (${chosen.url ? 'anonKey' : 'url'} is empty). Set both to enable accounts, or clear both to deploy local-only.`,
  );
}

// Refuse a privileged key before it can reach a bundle, matching the runtime
// guard in src/services/supabase/keyGuard.ts. The build is the last point where
// this is still recoverable; once deployed, the key is public.
if (isPrivilegedKey(chosen.anonKey)) {
  fail(
    `${chosen.name} holds a privileged Supabase key. service_role / sb_secret_ keys bypass Row Level Security and must never be bundled. Use the publishable (anon) key.`,
  );
}

let host;
try {
  const parsed = new URL(chosen.url);
  if (parsed.protocol !== 'https:') fail(`${chosen.name} must use an https Supabase URL.`);
  host = parsed.host;
} catch {
  fail(`${chosen.name} has an unparseable Supabase URL: ${chosen.url}`);
}

console.log('MACRONAUT_AUTH_MODE=accounts');
console.log(`MACRONAUT_SUPABASE_HOST=${host}`);
