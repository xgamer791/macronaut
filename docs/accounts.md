# Accounts and the backend (Convex)

Macronaut has one backend: a [Convex](https://convex.dev) deployment. Every
account's data — diary, custom foods, saved meals and recipes, goals, activity,
day notes, settings, the food lookup cache — lives there, so the same diary
shows up on every device the person signs in on. Nothing is kept in a local
database any more.

Sign-in is [Convex Auth](https://labs.convex.dev/auth). The app offers one
method:

| Provider | How it works | Deployment variables |
|---|---|---|
| Email and password | `convex/PasswordAccount.ts`. Create Account sends the address, the password, the name, the date of birth and the country in one call; Convex Auth hashes the password with Scrypt and stores only the hash on the account row. Signing in sends the address and the password. Forgot password emails a six-digit reset code and then accepts the code plus a new password. | `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` (reset email only) |
| AI food scan | A Convex action calls xAI with a shared key. The client never sees it. Until Pro exists, accounts that already existed when the roster froze (plus Holly Ky and the two preview emails) can invoke the action. Later sign-ups cannot. | `XAI_API_KEY` |

No third-party sign-in is offered, so Sign in with Apple is not required: the
App Store asks for it only in apps that offer another third-party sign-in.

Three older providers are still configured on the deployment — Google OAuth
(`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`), Apple on web, Android and iOS
(`AUTH_APPLE_ID` / `AUTH_APPLE_SECRET`, plus `apple-native` in
`convex/AppleNative.ts`), and the six-digit email code through
[Resend](https://resend.com) (`AUTH_RESEND_KEY` / `AUTH_EMAIL_FROM`) — so
accounts created with them still resolve to the same user and their sections
below still apply. Nothing in the app starts those flows any more.

## What an account is

`users` carries the name, the email, and the two facts create-account captures
and nothing may change afterwards: `birthday` (ISO `YYYY-MM-DD`) and `country`.
They are written in the same transaction that creates the account, so an
account cannot exist without them, and they are validated on the server as well
as on the form (`convex/lib/signupAccount.ts`): a real calendar date, at least
13 years ago, and a country. Everything else about a person — display name,
goals, meal times, appearance — is a row in `settings` they can edit whenever
they like.

Passwords must be eight characters or more with an upper case letter, a lower
case letter and a digit. The form greys out its button until they are, and the
server refuses anything less; `tests/convex/passwordSignUp.test.ts` keeps the
two rules in step.

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

### 5. Apple

Sign in with Apple needs one App ID, one Services ID and one key in the
[Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list),
then two variables per deployment. The
[Convex Auth Apple guide](https://labs.convex.dev/auth/config/oauth/apple) walks
through the portal screens; the Macronaut-specific values are:

| Thing | Value |
|---|---|
| App ID (explicit bundle ID) | `com.mangomarketeers.macronaut`, with **Sign in with Apple** checked |
| Services ID | `com.mangomarketeers.macronaut.web`, with `com.mangomarketeers.macronaut` as its **primary App ID** |
| Domain | `brainy-cobra-467.convex.site` (prod), `zany-hornet-105.convex.site` (dev) |
| Return URL | `https://brainy-cobra-467.convex.site/api/auth/callback/apple` (prod)<br>`https://zany-hornet-105.convex.site/api/auth/callback/apple` (dev) |
| Key | A **Sign in with Apple** key whose primary App ID is `com.mangomarketeers.macronaut`; downloads once as `AuthKey_XXXXXXXXXX.p8` |

`com.macronaut.app` was already taken in Apple's registry, which is why the App
ID is under the Mango Marketeers prefix. `app.config.ts` uses the same string as
the iOS bundle identifier, because Apple ties Sign in with Apple to the App ID
and the two have to agree.

The Services ID must share `com.mangomarketeers.macronaut` as its primary App
ID. That is what makes Apple return the same user identifier (`sub`) to the web
flow and to the iOS sheet, which is what lets both sign in to the same account.

```
npx convex env set AUTH_APPLE_ID com.mangomarketeers.macronaut.web
npx convex env set AUTH_APPLE_SECRET <client-secret-jwt>
```

`AUTH_APPLE_SECRET` is not the `.p8` key: it is a JWT signed with it (team id as
`iss`, the Services ID as `sub`, the key id in the header). Apple caps its
lifetime at six months, so it has to be regenerated and re-set twice a year —
web and Android sign-in start failing when it lapses. The
[Convex Auth guide](https://labs.convex.dev/auth/config/oauth/apple) has an
in-browser generator; `npx auth add apple` does the same from a terminal. Keep
the `.p8` out of the repository (`.gitignore` already covers `*.p8`).

Native iOS sign-in needs nothing else. It verifies Apple's identity token
against `https://appleid.apple.com/auth/keys` and checks the token was issued
for `com.mangomarketeers.macronaut`, so it has no secret to configure or rotate.
That bundle id is the default in `convex/AppleNative.ts`; set
`AUTH_APPLE_NATIVE_ID` to override it, and only if the iOS bundle identifier ever
changes again.

Two Apple quirks worth knowing before testing:

- **Apple refuses `localhost` and plain HTTP.** The web flow can only be
  exercised against a deployed HTTPS site, so test it on
  <https://xgamer791.github.io/macronaut> rather than `npm run web`. The iOS
  sheet has no such restriction.
- **The name arrives once.** Apple shares the person's name only on their first
  consent, and drops it on every later sign-in, so the value stored the first
  time is kept. To get a first consent again, remove Macronaut under Settings →
  your name → Sign in with Apple on the device.

### 6. Email codes

`AUTH_RESEND_KEY` is a Resend API key. `AUTH_EMAIL_FROM` is the sender, e.g.
`Macronaut <noreply@mangomarketeers.com>`. The domain must be verified in
Resend first; until it is, `Macronaut <onboarding@resend.dev>` works, but
**Resend only delivers from that address to the email of the Resend account
owner**, so nobody else can sign in with a code until the domain verifies.
Anyone else who asks for a code sees "Email sign-in isn't available yet. Use
Apple or Google for now." and the deployment log records Resend's 403.

To go live: in Resend open **Domains → Add domain**, enter the domain, create
the DNS records it lists at the registrar (a DKIM `TXT`, an `MX` and `TXT`
for the bounce subdomain, optionally `DMARC`), and wait for the domain to
show **Verified**. Then set `AUTH_EMAIL_FROM` on the production deployment to
an address on that domain. Convex reads environment variables at call time,
so the next code goes out from the new sender without a redeploy.

### 7. AI food scan (`XAI_API_KEY`)

The shared xAI key belongs on the Convex deployment, not in a table and not
in the app bundle:

```
npx convex env set XAI_API_KEY xai-…          # dev
npx convex env set XAI_API_KEY xai-… --prod   # prod
```

Or paste it under **Settings → Environment Variables** in the Convex
dashboard. Rotate it there; do not store it in a database table, user
settings, or `EXPO_PUBLIC_*`. Without this variable, allow-listed accounts
see “AI food scan is not configured”.

### 8. Verify

```bash
npm run web
```

Create an account, add a diary entry, sign out, then create a second one on a
different address. The second account must see an empty diary; sign back in as
the first and the entry must be there. `tests/convex/passwordSignUp.test.ts`
and `tests/convex/isolation.test.ts` run the same checks against the functions
on every push, but the round trip through a real browser is still worth doing
after any change to auth.

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

## One person, several sign-in methods

An address is one account: create-account lower-cases and trims it, and a second
sign-up on the same address is refused rather than made into a duplicate.

Convex Auth links a new sign-in to an existing user when the provider hands over
an email address it has verified and exactly one account already has it. Google
and Apple both do, so an account created with Apple after Google — same address —
lands in the same diary rather than a second empty one. A password is deliberately
not linked that way: proving you can receive mail at an address does not prove
you chose its password, so a password sign-up on an address that already has a
Google or Apple account is refused. Forgot password only resets an existing
password account; it does not attach a password to an older Google or Apple
account.

Apple's Hide My Email option is the exception, and unavoidably so: it hands over
a `@privaterelay.appleid.com` address instead, which nothing else shares, so that
sign-in is a separate account. Nothing to fix; it is what the person asked for.

## Sessions

Convex Auth issues a short-lived JWT (one hour) and a refresh token (thirty
days, rotated on use). The client reuses that stored JWT when the app
reopens — immediately rotating the refresh token on every launch was signing
people out if they closed the app mid-handshake. A refresh is scheduled
before the hour is up. On native both tokens go to `expo-secure-store`
(Keychain / EncryptedSharedPreferences) through
`src/services/storage/deviceStore.ts`, chunked because SecureStore rejects
values over 2048 bytes. On web they are in `localStorage`, which also lets
sign-in state sync across tabs. Signing out clears this device only.

## Deleting data

Settings → Data → **Delete all data** erases every row the account owns and
keeps the account. Settings → Account → **Delete account** erases the rows,
then the sessions, linked sign-in methods and the user record, so the next
sign-in with that email starts from nothing. Both run in bounded batches on
the server and the app repeats them until the server reports done.
