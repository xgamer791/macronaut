# Security review

Written while wiring Supabase accounts. Section 1 is what this change fixes,
section 2 is what is still open, with the reasoning for each.

## 1. Fixed

### Sign-in was not sign-in

`login.tsx` wrote `authComplete: true` into the local `settings` table and every
guard read it back. Nothing was verified against anything. On web, one
IndexedDB edit unlocked the app; the "account" had no identity, so the
`displayName` derived from the typed email was decoration.

Guards now read a Supabase session from `AuthProvider`. Email sign-in sends a
six-digit code and verifies it server-side; Google runs the OAuth code flow
with PKCE.

### Every account shared one local database

This is the hole that adding accounts would have created. The local SQLite
database was a single per-device file. Signing out and signing in as someone
else would have shown the second person the first person's diary, weight and
goals, because no layer distinguished them.

`src/db/scope.ts` now gives each account its own database — a separate SQLite
file on native, a separate IndexedDB record on web. The pre-accounts database
is adopted by the first account to sign in, so existing installs keep their
history instead of losing it behind a login. If the scope cannot be recorded
(locked keychain, storage disabled) the account falls back to a scope private
to its user id: failing closed rather than sharing.

`AuthProvider` resolves the scope before children mount, remounts
`AppProvider` when it changes, and tags resolved scopes with the user they
belong to so a scope from the previous account is never reused.

### Cached rows outlived the account that fetched them

React Query held diary, goal and progress results in memory across a sign-out.
The cache is now cleared on sign-out and on any database scope change.

### A privileged key could have been bundled

`EXPO_PUBLIC_*` values are compiled into the JavaScript every user downloads.
Pasting a `service_role` / `sb_secret_` key into `EXPO_PUBLIC_SUPABASE_ANON_KEY`
would have published a credential that bypasses Row Level Security entirely.

`keyGuard.ts` decodes the key's role and refuses to build a client for a
privileged one, and rejects an `http` endpoint for any non-localhost host so
token traffic cannot be downgraded to cleartext.

### Server-side isolation is enforced by the database

`supabase/migrations/0001_accounts_and_rls.sql`:

- Row Level Security is enabled **and forced**, so even a migration running as
  the table owner does not silently bypass the policies.
- `anon` is granted nothing on user data. The bundled publishable key
  authenticates as `anon` until sign-in, so anything `anon` can read is public.
- `authenticated` gets column-level grants. `id` is not updatable, so a user
  cannot re-parent their row onto another account.
- Policies use `(select auth.uid())` so it is evaluated once per statement
  rather than once per row.
- Profiles are provisioned by a `security definer` trigger on `auth.users`
  with `search_path = ''`, which closes the search-path hijack that
  `security definer` functions are prone to. A signed-in client cannot create
  rows for anyone else.
- No delete policy: accounts are removed through `auth.users` and the cascade
  takes the profile with them.

The rule to keep: the client never filters by user id for security. The
database refuses the rows either way.

### Smaller items

- Session tokens are stored in `expo-secure-store` on native instead of an
  ordinary key-value store, chunked because SecureStore rejects values over
  2048 bytes and truncating a session silently is worse than not storing it.
  A partially written value reads back as absent.
- Email validation was `email.includes('@')`, which accepted `@`. It now
  requires a local part, a domain and a TLD, and normalises case so one address
  is one account.
- Provider metadata (`full_name` from Google) is attacker-controlled text. It
  is type-checked and capped at 60 characters before being used as a display
  name, and the same cap is applied server-side in the trigger.
- Raw provider error strings are no longer rendered. `friendlyAuthError` maps
  them to messages that say what to do next without echoing server internals.
- `signOut` uses `scope: 'local'`, so signing out of a phone does not
  invalidate sessions on the user's other devices.
- Device store keys are validated against `[A-Za-z0-9._-]+`, so no caller can
  escape the SecureStore or `localStorage` namespace.

## 2. Open

Ordered by how much they matter.

### Third-party API credentials are published in the bundle

`src/services/food/fatsecret.ts` reads `EXPO_PUBLIC_FATSECRET_CLIENT_ID` and
`EXPO_PUBLIC_FATSECRET_CLIENT_SECRET` and sends them as an HTTP Basic
`client_credentials` grant. An OAuth2 client secret in a public client is a
leaked credential by construction: anyone can read it out of the bundle and
spend the quota, or use it wherever else it is accepted.
`EXPO_PUBLIC_NUTRITIONIX_APP_KEY` has the same problem. The USDA key is lower
stakes — it only gates a rate limit.

This predates accounts and is unchanged here. The fix is a server-side proxy —
a Supabase Edge Function holding the secrets and forwarding search and barcode
requests — after which the client needs no provider credentials at all. Until
then, treat any configured FatSecret or Nutritionix credential as public and
scope it to nothing else.

### The user's own xAI key is stored in plaintext

`grokApiKey` lives in the local `settings` table, so on web it sits in
IndexedDB as readable text and any XSS on the origin can exfiltrate it. It
should move to the device store added here (`expo-secure-store` on native), and
it is worth reconsidering whether the app should hold a user's provider key at
all rather than proxying through a backend.

### The local database is not encrypted at rest

Web IndexedDB is unencrypted, and native SQLite relies on the OS sandbox and
full-disk encryption rather than SQLCipher. Signing out leaves the account's
diary on the device by design, so a recovered unlocked device exposes it.
"Delete all data" is the only eraser today. SQLCipher via
`expo-sqlite`'s encryption support would close this on native; the web build
has no good answer while it has to run on a static host.

### Web sessions are reachable from script

A static host cannot set `httpOnly` cookies, so the session lives in
`localStorage` and any successful XSS can steal it. What keeps that acceptable
is that the app loads no third-party scripts and renders no raw HTML — worth
re-checking before adding either. Short access-token lifetimes and rotating
refresh tokens limit the window.

### App Store requirement

iOS requires Sign in with Apple wherever a third-party social login is
offered. Google sign-in ships here without it, which will fail review. Add
`signInWithOAuth({ provider: 'apple' })` and enable the Apple provider before
submitting.

### No MFA, and no in-app account deletion

Supabase supports TOTP enrolment; nothing in the app exposes it. There is also
no in-app path to delete the Supabase user — required by both app stores for
accounts. Deleting a user cascades to `profiles`, so the server side is ready;
the UI and an Edge Function to call the admin API are not.

### Free-tier operational limits

The Supabase free plan has no point-in-time recovery or managed backups, no
HIPAA BAA, and pauses a project after a week of inactivity. Nutrition data is
sensitive even when it is not regulated. The free tier is fine while the app is
local-first with no server-side copy of the diary; revisit all three before
cloud sync stores real user data.

### Email delivery is on the shared sender

Supabase's built-in SMTP is rate-limited to a few messages per hour and is not
intended for production. Configure project SMTP before real users, or sign-in
will fail for the second person to try it that hour.

## Verifying isolation

The regression that matters most cannot be caught by a unit test alone. After
any change to auth or the database layer:

1. Sign in as A, log a diary entry.
2. Sign out, sign in as B. B's diary must be empty.
3. Sign out, sign back in as A. A's entry must be there.

`src/db/__tests__/scope.test.ts` covers the scope resolution underneath this,
including the fallbacks when the device store is unreadable or unwritable.
