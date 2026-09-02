# Accounts and the backend (Convex)

Macronaut has one backend: a [Convex](https://convex.dev) deployment. Every
account's data — diary, custom foods, saved meals and recipes, goals, activity,
day notes, settings, the food lookup cache — lives there, so the same diary
shows up on every device the person signs in on. Nothing is kept in a local
database any more.

Sign-in is [Convex Auth](https://labs.convex.dev/auth) with two providers:

| Provider | How it works | Deployment variables |
|---|---|---|
| Google | OAuth code flow with PKCE. The consent screen returns to the Convex **site** URL, which holds the client secret; the app only ever sees a one-time code. | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Email code | A six-digit code sent through [Resend](https://resend.com), valid for ten minutes. Works identically on web, iOS and Android with no deep-link setup. | `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` |

The app bundle contains exactly one backend value, `EXPO_PUBLIC_CONVEX_URL`,
which is public by design (it is the address clients connect to). Every secret
is an environment variable on the Convex deployment and never reaches the
bundle, the repository, or CI.

## Deployments

| Deployment | Used for | Where its URL goes |
|---|---|---|
| dev (per developer) | `npx convex dev` on your machine | `.env.local`, written by the CLI (gitignored) |
| prod | The live site | Injected by `npx convex deploy` in the deploy workflow |

The Convex dashboard for the project lists both under the `macronaut` project.

## Setting up a deployment

Do this once for prod, and once per developer for dev. Everything except
step 1 is a value in the dashboard under **Settings → Environment Variables**
(or `npx convex env set NAME value`, add `--prod` for production).

### 1. Link the repo and push the functions

```bash
npx convex dev
```

The first run signs you in to Convex, picks the project, writes
`CONVEX_DEPLOYMENT` and `EXPO_PUBLIC_CONVEX_URL` to `.env.local`, regenerates
`convex/_generated/`, and pushes `convex/` to your dev deployment. Leave it
running while you work; it re-pushes on every save.

### 2. Session signing keys

```bash
node scripts/convex-auth-keys.mjs          # dev
node scripts/convex-auth-keys.mjs --prod   # prod
```

Generates an RS256 key pair on your machine and stores it as
`JWT_PRIVATE_KEY` and `JWKS`. The private key is never printed or written
anywhere else. Re-running rotates it, which signs everyone out.

### 3. `SITE_URL`

The web app's own URL, which is where OAuth returns after consent:

```
https://xgamer791.github.io/macronaut        # prod
http://localhost:8081                        # dev, for `npm run web`
```

`convex/auth.ts` refuses any other destination except the app's native scheme
(`macronaut://`), Expo Go (`exp://…`) and `http://localhost:*`. That allow-list
is a security control: it stops an attacker sending the sign-in code to a site
they control. (The code is useless without the PKCE verifier held by the client
that started the flow, but there is no reason to hand it out.)

### 4. Google

In the Google Cloud console the OAuth client's **authorised redirect URI** is
the Convex site URL's callback, one per deployment:

```
https://<deployment>.convex.site/api/auth/callback/google
```

Copy the client ID and secret to `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
The consent screen must link to the app's Privacy Policy and Terms
(`/privacy` and `/terms` on the site) before Google will publish it.

### 5. Email codes

`AUTH_RESEND_KEY` is a Resend API key. `AUTH_EMAIL_FROM` is the sender, e.g.
`Macronaut <noreply@mangomarketeers.com>`. The domain must be verified in
Resend first; until it is, `Macronaut <onboarding@resend.dev>` works, but
**Resend only delivers from that address to the email of the Resend account
owner**, so nobody else can sign in with a code until the domain verifies.

### 6. Verify

```bash
npm run web
```

Sign in with an email code, add a diary entry, sign out, then sign in as a
second address. The second account must see an empty diary; sign back in as
the first and the entry must be there. `tests/convex/isolation.test.ts` runs
the same check against the functions on every push, but the round trip through
a real browser is still worth doing after any change to auth.

## Deploying

The deploy workflow (`.github/workflows/deploy.yml`) runs on every push to
`main`:

```bash
npx convex deploy --cmd 'npm run export:web' --cmd-url-env-var-name EXPO_PUBLIC_CONVEX_URL
```

That pushes `convex/` to the production deployment, then exports the web build
with `EXPO_PUBLIC_CONVEX_URL` set to that deployment's URL, so the bundle can
only point at the backend that was just deployed. The workflow then fails if
the URL is missing from the exported bundle.

It needs one repository secret, **`CONVEX_DEPLOY_KEY`**: the production deploy
key from the dashboard (**Settings → Deploy keys**). It can push code to the
backend, so it lives only in GitHub Actions secrets — never in the repository,
`.env`, or the bundle. Without it the workflow stops with a clear error before
building anything.

After a deploy:

```bash
./scripts/verify-live.sh
```

prints `backend=https://….convex.cloud`, read from the bundle the CDN is
actually serving.

## How isolation works

Every function in `convex/` starts by resolving the caller from the verified
session (`requireUserId` in `convex/lib/auth.ts`). Every table carries a
`userId`, every read goes through an index that starts with it, and every
write to an existing row checks that the row belongs to the caller. The client
never passes a user id; there is nothing for it to get wrong.

A call with no session throws before touching data. Knowing another account's
row id gets you nothing: reads return null, writes throw.

## Sessions

Convex Auth issues a short-lived JWT (one hour) and a refresh token (thirty
days, rotated on use). On native both go to `expo-secure-store` (Keychain /
EncryptedSharedPreferences) through `src/services/storage/deviceStore.ts`,
chunked because SecureStore rejects values over 2048 bytes. On web they are in
`localStorage`, which also lets sign-in state sync across tabs. Signing out
clears this device only.

## Deleting data

Settings → Data → **Delete all data** erases every row the account owns and
keeps the account. Settings → Account → **Delete account** erases the rows,
then the sessions, linked sign-in methods and the user record, so the next
sign-in with that email starts from nothing. Both run in bounded batches on
the server and the app repeats them until the server reports done.
