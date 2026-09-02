# Accounts (Supabase)

Macronaut runs in one of two modes, decided at build time by whether
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.

| Mode | When | Sign-in | Data |
|---|---|---|---|
| Local-only | Supabase env vars absent (the public GitHub Pages demo) | "Continue on this device" | One local database, nothing leaves the device |
| Accounts | Supabase env vars present | Google, or a six-digit email code | One local database **per account** on the device |

Nothing syncs to the cloud yet. Signing in establishes identity and isolates
each account's local database; the diary itself is still local-first. See
[architecture.md](architecture.md) for the seams sync will use.

## Project setup

### 1. Create the project

Create a free project at [supabase.com](https://supabase.com), then copy
**Project URL** and the **publishable (anon) key** from Project Settings → API
into `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Never put the `service_role` / `sb_secret_` key here. Everything in an
`EXPO_PUBLIC_*` variable ships inside the JavaScript bundle every user
downloads, and the secret key bypasses Row Level Security. The app checks the
key's role at startup and refuses to create a client if it is privileged.

### 2. Apply the schema

Run [`supabase/migrations/0001_accounts_and_rls.sql`](../supabase/migrations/0001_accounts_and_rls.sql)
in the SQL editor, or `supabase db push` with the CLI. It creates `profiles`,
enables and forces Row Level Security, grants `authenticated` only the columns
it needs, gives `anon` nothing, and provisions each profile from a
`security definer` trigger on `auth.users`.

The file ends with the template every future user-owned table should copy, so
isolation is written into the table definition rather than remembered later.

### 3. Enable the email code

Email sign-in uses a one-time code rather than a magic link, so it works
identically on web, iOS and Android with no deep-link or universal-link setup.

Supabase's default magic-link template only contains a URL, so add the token to
it under **Authentication → Email Templates → Magic Link**:

```html
<h2>Your Macronaut sign-in code</h2>
<p>{{ .Token }}</p>
<p>This code expires shortly. If you didn't ask for it, ignore this email.</p>
```

Under **Authentication → Providers → Email**, confirm "Enable Email provider"
is on. Leave "Confirm email" on: `verifyOtp` confirms the address as part of
signing in.

The built-in SMTP service is rate-limited to a handful of emails per hour and
is not meant for production. Configure your own SMTP under **Authentication →
Emails → SMTP Settings** before real users arrive.

### 4. Enable Google

Under **Authentication → Providers → Google**, add the OAuth client ID and
secret from the Google Cloud console. In Google Cloud, the authorised redirect
URI is Supabase's callback:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Then add the URLs the app itself returns to, under **Authentication → URL
Configuration → Redirect URLs**:

```
macronaut://                                  # native (Expo scheme from app.config.ts)
http://localhost:8081/                        # expo start --web
https://xgamer791.github.io/macronaut/        # GitHub Pages deploy
```

The GitHub Pages entry **must include the `/macronaut/` sub-path**. The site is
served from a sub-path, not the domain root, and Supabase matches redirect URLs
exactly (or by explicit wildcard, e.g.
`https://xgamer791.github.io/macronaut/**`). An entry for the bare host will not
match and sign-in will fail. `authRedirectUrl()` builds the same URL from
`EXPO_PUBLIC_BASE_PATH`, so the two stay in step.

Set **Site URL** to the same GitHub Pages URL.

That allow-list is a security control, not configuration noise: it is what
stops an attacker sending the authorization code to a site they control.
Supabase rejects any `redirectTo` that is not on it, so add only origins you
own.

Sign-in uses the PKCE flow, so the authorization code is worthless without the
verifier held by the client that started the flow.

### 5. Verify

```bash
npm run web
```

Sign in with an email code, add a diary entry, sign out, then sign in as a
second address. The second account must see an empty diary. Sign back in as the
first and its entries must return. That round trip is the isolation guarantee —
if it fails, stop and fix it before shipping.

## Deploying accounts to GitHub Pages

`EXPO_PUBLIC_*` values are inlined when the bundle is built, so the live site
only gets accounts if the deploy workflow is given them. Add two **repository
secrets** (Settings → Secrets and variables → Actions), or repository variables
of the same names — `.github/workflows/deploy.yml` accepts either:

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the publishable (anon) key |

With neither set, the workflow deploys the local-only build — which is what the
public demo has always been, so nothing breaks by leaving them out.

The workflow fails the deploy if `EXPO_PUBLIC_SUPABASE_URL` is set but the
project host is missing from the exported bundle. A misnamed secret otherwise
produces a local-only site that looks like a successful deploy.

After the deploy finishes, confirm which mode actually went live:

```bash
./scripts/verify-live.sh
```

It reports `auth=accounts (supabase project: …)` or `auth=local-only`, read from
the bundle the CDN is really serving rather than from the repository settings.

Finally, run the two-account round trip from step 5 above against the live URL.
Sign-in cannot work until the Supabase redirect allow-list contains
`https://xgamer791.github.io/macronaut/`, including the sub-path.

## How isolation works on the device

Before accounts there was one local SQLite database per device. Adding sign-in
without scoping it would hand the next person to sign in on a shared phone or
browser the previous account's diary.

`src/db/scope.ts` resolves a database scope per account:

- Local-only mode uses the pre-accounts database.
- The first account to sign in on the device **adopts** the pre-accounts
  database, so anyone upgrading keeps the history they already had.
- Every account after that gets its own SQLite file (native) or IndexedDB
  record (web).
- If the scope cannot be recorded — locked keychain, disabled storage — the
  account falls back to a scope private to its user id. Failing closed keeps a
  broken device from becoming a data leak.

`AuthProvider` resolves the scope before children mount and remounts
`AppProvider` when it changes, so no repository outlives the account it was
created for. The React Query cache is cleared on every scope change, because a
cached diary result belongs to whoever fetched it.

Signing out does not erase the local database: the account keeps its data for
next time. Use Settings → Data → **Delete all data** to erase it.

## Session storage

Sessions live in `expo-secure-store` on native (Keychain /
EncryptedSharedPreferences) and `localStorage` on web, which is all a static
host can offer. Values are chunked because SecureStore rejects anything over
2048 bytes and a Supabase session is bigger than that.

Refresh tokens rotate automatically, and auto-refresh is restarted when the app
returns to the foreground so iOS suspending the timer does not strand a stale
session. `signOut` uses `scope: 'local'`, so signing out of one device leaves
the user's other devices signed in.
