#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap: installs the local Convex dev backend,
# pushes the functions in convex/, writes .env.local (EXPO_PUBLIC_CONVEX_URL),
# and ensures the Convex Auth signing keys exist so email+password sign-in works
# entirely locally — no Convex account or external provider required.
#
# This uses Convex's anonymous local deployment (beta) so a fresh agent gets a
# real, working backend. Production still uses a cloud deployment via
# CONVEX_DEPLOY_KEY in .github/workflows/deploy.yml.
set -euo pipefail

cd "$(dirname "$0")/.."

export CONVEX_AGENT_MODE=anonymous

# First run downloads the backend binary and, on a brand-new machine, offers to
# scaffold "Convex AI files". Answer "no" non-interactively and push the
# functions once so .env.local and convex/_generated are written.
printf 'n\n' | npx convex dev --once --tail-logs disable

# Convex Auth signs session JWTs with JWT_PRIVATE_KEY / JWKS deployment env
# vars. Generate them once; skip if they are already present so reruns keep the
# same signing key (rotating it would sign every session out).
if ! npx convex env get JWT_PRIVATE_KEY >/dev/null 2>&1; then
  node scripts/convex-auth-keys.mjs
fi

echo "Convex local backend is configured. EXPO_PUBLIC_CONVEX_URL:"
grep EXPO_PUBLIC_CONVEX_URL .env.local || true
