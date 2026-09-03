# Shipping Macronaut on iOS — Apple-side setup

Everything here is account and portal work that cannot be done from the
repository. The code side (`eas.json`, the HealthKit config plugin, the
entitlement) is already committed, so once these are in place a build can be
signed.

Context: Macronaut has always been an iOS app in code — same Expo source as the
website, with an iOS bundle identifier and Sign in with Apple already
configured. It has just never been built or distributed. Nothing is being
rewritten. See [docs/apple-health.md](apple-health.md) for what the Health
feature itself needs.

## What I need back from you

I cannot look any of this up, and a few files need the values.

| Value | Where to find it |
|---|---|
| **Apple Team ID** (10 characters) | developer.apple.com → Account → Membership details |
| **Apple ID email** of the developer account | The address you sign in with |
| **Expo account name** | expo.dev → the account or organisation that should own the build |
| **App Store Connect app ID** (numeric) | Only if an app record already exists — App Store Connect → the app → App Information |
| **iPhone and Watch models + OS versions** | Settings → General → About, on both |

The OS versions matter for scope: controlling a workout from the phone needs
**iOS 17 or later and watchOS 10 or later**, because it relies on HealthKit's
mirrored workout sessions. Below that, the watch app would need a fallback.

## 1. Apple Developer portal — Identifiers

The App ID `com.mangomarketeers.macronaut` should already exist, because Sign in
with Apple uses it today. It needs one new capability.

1. developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers**
2. Open **`com.mangomarketeers.macronaut`**
3. Under Capabilities, tick **HealthKit**
4. Leave **Sign in with Apple** exactly as it is — the Services ID
   `com.mangomarketeers.macronaut.web` has this App ID as its primary, and
   changing it would break web sign-in and give existing users a different
   Apple user id (see [docs/accounts.md](accounts.md))
5. Save

Two things worth knowing:

- **HealthKit needs no approval from Apple.** It is a normal capability you
  switch on. The entitlement that does require a written request is *Clinical
  Health Records*, which Macronaut does not use.
- EAS can enable this capability itself during the first build, by reading the
  entitlements file. Doing it by hand first is faster and makes the failure
  mode obvious if the account lacks permission. Either way, confirm the tick
  is there afterwards.

## 2. Apple Developer portal — devices and signing

HealthKit on the simulator has a store but no real Watch data, so testing needs
a physical iPhone paired to your Watch.

1. Register the iPhone as a development device. `eas device:create` handles
   this by sending you a registration link, or add the UDID manually under
   **Devices**.
2. Let **EAS manage certificates and provisioning profiles**. There is nothing
   to create by hand, but the Apple ID you connect must be **Account Holder or
   Admin** — a Developer-role account cannot create distribution certificates,
   and the build will fail with a permissions error rather than a clear one.

## 3. App Store Connect — app record

Needed for TestFlight and for submission. Skip if the record already exists.

1. App Store Connect → **Apps** → **+** → **New App**
2. Platform **iOS**, bundle ID **`com.mangomarketeers.macronaut`**, primary
   language, a name, and any SKU you like
3. Add yourself as an **internal TestFlight tester**

## 4. App Store Connect — privacy, which is where HealthKit apps get rejected

These are hard requirements rather than nice-to-haves.

1. **Privacy policy URL is mandatory** for any app using HealthKit. Macronaut
   already publishes one:
   `https://xgamer791.github.io/macronaut/privacy`. Paste it into App
   Information → Privacy Policy URL.
2. **App Privacy questionnaire**: declare **Health** and **Fitness** data
   types, used for **App Functionality**, **linked to the user's identity**
   (the diary is per-account), and **not used for tracking**.
3. **Health data must never be used for advertising or sold**, and must not be
   shared with third parties for advertising. That is an App Review rule, not
   just a policy preference. Macronaut does neither, so this is a declaration
   rather than a change.
4. Give App Review a **way to sign in**. The app is entirely behind login, and
   reviewers cannot use your Apple or Google account. The six-digit email code
   path exists for this; put working credentials or a test address in the
   review notes, or the build gets rejected before anyone opens it.

Once the privacy policy mentions Apple Health specifically, `LEGAL_LAST_UPDATED`
in `src/utils/legal.ts` should be bumped. That is a code change and I will
handle it when the Health feature lands — it is listed here only so the
submission and the policy do not disagree.

## 5. Later, only if we build the Watch app

**Do not set this up yet.** It is only needed for starting and stopping
workouts from the app, which is a separate phase and a real watchOS project.

- A second App ID, `com.mangomarketeers.macronaut.watchkitapp`, with HealthKit
  enabled. The suffix is not a convention — iOS refuses to install a watch app
  whose bundle id is not the phone app's id plus a suffix.
- No separate App Store Connect record: a watch app ships inside the same app.

## What is deliberately not on this list

- **Paid Applications agreement** — not needed; the app is free with no
  in-app purchases.
- **Push notification key** — nothing sends notifications.
- **Apple Music, Maps, or other service keys** — unused.
- **Anything for the website.** The web build keeps deploying from `main` to
  GitHub Pages exactly as it does now, against the same Convex backend, and is
  unaffected by all of the above.

## After the portal work, from the repository

For reference — this is my side, listed so the sequence is clear.

```bash
npx eas init            # links the repo to your Expo account
npx eas build --profile development --platform ios
```

Because `app.config.ts` is a dynamic config, `eas init` cannot write the
project id into it automatically — it prints the id and it has to be added by
hand as `extra.eas.projectId`. Send me the id and I will commit it.

The `development` profile builds a dev client: native code including the
HealthKit entitlement, with JavaScript loaded from Metro, so day-to-day work
does not need a new build. `preview` and `production` build against the
production Convex deployment (`brainy-cobra-467`), already set in `eas.json`.

The optional food-provider API keys (USDA, Nutritionix, FatSecret) are not
required — the app falls back to bundled generics and Open Food Facts. If you
want them in native builds they go in EAS environment variables rather than
`eas.json`, since two of them are secrets.
