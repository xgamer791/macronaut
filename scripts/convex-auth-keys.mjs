#!/usr/bin/env node
/**
 * Generates the RS256 key pair Convex Auth signs sessions with and stores it
 * on a Convex deployment as JWT_PRIVATE_KEY and JWKS.
 *
 * The private key is generated on this machine and handed straight to
 * `npx convex env set`; it is never printed, written to disk, or committed.
 *
 * Usage:
 *   node scripts/convex-auth-keys.mjs          # this machine's dev deployment
 *   node scripts/convex-auth-keys.mjs --prod   # the production deployment
 *
 * Re-running rotates the key, which signs every user out.
 */
import { spawnSync } from 'node:child_process';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const prod = process.argv.includes('--prod');

const keys = await generateKeyPair('RS256', { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey }] });

// `NAME=value`, not `NAME value`: a PKCS8 PEM opens with `-----BEGIN`, which
// the CLI's argument parser reads as an unknown option.
function setEnv(name, value) {
  const args = ['convex', 'env', 'set', ...(prod ? ['--prod'] : []), `${name}=${value}`];
  const result = spawnSync('npx', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) {
    console.error(`Failed to set ${name} on the ${prod ? 'production' : 'dev'} deployment.`);
    process.exit(result.status ?? 1);
  }
}

// PKCS8 PEM has newlines; Convex env vars are single-line, and Convex Auth
// accepts the space-joined form.
setEnv('JWT_PRIVATE_KEY', privateKey.trimEnd().replace(/\n/g, ' '));
setEnv('JWKS', jwks);

console.log(
  `Set JWT_PRIVATE_KEY and JWKS on the ${prod ? 'production' : 'dev'} deployment. Existing sessions are now signed out.`,
);
