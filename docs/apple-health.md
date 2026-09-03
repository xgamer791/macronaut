# Apple Health and Apple Watch — plan

Status: **paused.** Groundwork is in the repo (EAS + HealthKit entitlement);
nothing reads Health data yet. Picked back up after the rest of the build,
once a development iOS build is on a real iPhone. The same checklist is in
the app at Settings → Apple Health and Watch (`/apple-health`).

This document is the plan for reading Apple Health data (steps, heart rate,
calories burned) and for starting and stopping workouts from the app on an
Apple Watch.

Read this before writing any code, because the two halves of the feature have
very different costs and one of them is not a React Native task at all.

## The short version

1. Everything the Apple Watch already measures — steps, heart rate, active
   energy, workouts — is written into HealthKit on the paired iPhone. Reading
   it is an ordinary React Native feature and covers most of what we want.
2. Starting and stopping a workout **from** the app is a different project. It
   needs a real watchOS app written in SwiftUI, because `HKWorkoutSession` does
   not exist on iOS. No JavaScript library can do it.
3. Before either one, Macronaut needs an iOS build that does not exist today.

So this is phased: an iOS build, then read-only Health import, then the watch
app.

## What already exists in the codebase

More than you would expect. The activity model was written with this in mind.

`activityEntries` already carries a source discriminator and an external id:

```64:68:convex/lib/validators.ts
export const activitySourceValidator = v.union(
  v.literal('manual'),
  v.literal('apple_watch'),
  v.literal('healthkit'),
);
```

```151:162:convex/lib/validators.ts
export const activityEntryFields = {
  date: v.string(),
  name: v.string(),
  activityType: activityTypeValidator,
  durationMin: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  caloriesBurned: v.number(),
  intensity: v.optional(activityIntensityValidator),
  notes: v.optional(v.string()),
  sourceType: activitySourceValidator,
  sourceId: v.optional(v.string()),
};
```

An imported HealthKit workout is just an `activityEntries` row with
`sourceType: 'healthkit'` and the HealthKit sample UUID in `sourceId`. The
table, the queries, the repository and the day/week aggregation all work
already.

Two gaps:

- **Steps are a stub.** Today reads `stepsToday:${date}` from the settings
  table, but nothing ever writes that key, so the hero module always shows
  zero. The UI is built and waiting for a number. Because the key was never
  written, there is no data to migrate — we can move steps to a proper table
  and lose nothing.
- **Heart rate does not exist** anywhere in the schema, the types, or the UI.

## Why an iOS build is step zero

Macronaut is a web app today. There is no `ios/` directory, no `eas.json`, and
CI only runs `npm run export:web` and publishes to GitHub Pages. HealthKit is
iOS-only, does not work in Expo Go, and needs a development build with the
HealthKit entitlement.

That means the first phase is not a feature at all — it is standing up an iOS
build: an Apple Developer account, `eas.json`, a dev client, provisioning, and
eventually App Store review with health-data privacy disclosures. The
Apple-side half of that is written up in [docs/ios-setup.md](ios-setup.md); the
repository half (`eas.json`, the config plugin, the entitlement) is done.

Everything below is invisible on web and on Android. The web build stays the
primary product and must keep working untouched, so every Health surface is
gated behind a capability check rather than a platform check sprinkled through
the screens.

## Phase 1 — read from Apple Health

**This phase alone delivers most of the request.** The Apple Watch writes
steps, heart rate, active energy and workouts into HealthKit on the phone by
itself. We do not need a watch app to *monitor* any of it — only to *control*
a workout.

### Library

[`@kingstinct/react-native-healthkit`](https://kingstinct.com/react-native-healthkit/).
It ships an Expo config plugin, which is now wired up in `app.config.ts`. Note
that its `background` option is opt-*out*: the plugin adds the
`com.apple.developer.healthkit.background-delivery` entitlement unless you pass
`false`. It does not add `UIBackgroundModes`, which is a separate decision for
whenever background observers actually land.

It covers everything Phase 1 needs: `queryWorkoutSamplesWithAnchor`,
`queryStatisticsCollectionForQuantity` for daily step and energy totals,
per-workout `getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min')`
for average/min/max heart rate, and `saveWorkoutSample` for writing back later.

It does **not** cover workout sessions. That is Phase 2's problem.

### Schema changes

Additive fields on `activityEntryFields`, all optional so existing manual rows
stay valid:

| Field | Why |
|---|---|
| `startedAt`, `endedAt` (ISO) | HealthKit workouts are instants, not day keys. Needed to assign a workout to the right local day and to match heart-rate samples to it. |
| `avgHeartRate`, `maxHeartRate` (bpm) | From the workout's HealthKit statistics. |
| `sourceApp` | HealthKit tells us which app wrote the workout (Watch, Strava, Nike). Worth showing and worth filtering on. |

One new index on `activityEntries` for deduplication:
`by_user_source: ['userId', 'sourceType', 'sourceId']`. Without it, every sync
scans the user's whole workout history to answer "do I already have this
UUID?".

A new table for whole-day metrics, which the settings-key convention cannot
serve because it has no range query and therefore cannot feed the Progress
charts:

```ts
healthDays: defineTable({
  userId: v.id('users'),
  date: v.string(),
  steps: v.optional(v.number()),
  activeEnergyKcal: v.optional(v.number()),
  exerciseMinutes: v.optional(v.number()),
  restingHeartRate: v.optional(v.number()),
  updatedAt: v.string(),
}).index('by_user_date', ['userId', 'date']),
```

One row per user per day, overwritten on each sync. Today's steps hero module
switches from the dead settings key to this table.

### Sync

A single idempotent Convex mutation that takes a batch of workouts and upserts
by `sourceId`, plus the UUIDs HealthKit reports as deleted so we can remove
them. Anchored queries make this incremental.

**The anchor belongs on the device, not in the account.** HealthKit anchors are
per-store, so a user with an iPhone and an iPad would corrupt each other's sync
if the anchor lived in Convex. It goes in `deviceStore` (`expo-secure-store`)
next to the session tokens.

### Client layering

The repo's rule is that screens depend on repositories and calculation lives in
pure modules. Health fits as a service, like `services/food/`:

```
src/services/health/
  index.ts          capability check + the interface
  healthKit.ios.ts  the only file that imports the native module
  healthKit.ts      no-op stub for web and Android
  mapping.ts        PURE: HKWorkoutActivityType → ActivityType, dedupe rules
```

The platform split follows the existing `ScannerView.tsx` /
`ScannerView.web.tsx` pattern, so the web bundle never pulls in the native
module. Keeping `mapping.ts` pure matters: the Jest suite runs in plain Node,
so the interesting logic (activity-type mapping, day assignment across
midnight, dedupe, echo suppression) stays testable without a simulator.

### The part that needs a product decision

Burned calories are not cosmetic. They increase how much you are allowed to
eat:

```19:39:src/domain/aggregation.ts
export function dayProgress(
  date: DayKey,
  entries: Nutrition[],
  config: GoalConfig,
  marks: DayTypeMarks = {},
  burned = 0,
): DayProgress {
  const consumed = sumNutrition(entries);
  const target = resolveTargetForDate(date, config, marks);
  const safeBurned = Math.max(0, burned);
  const netCalories = consumed.calories - safeBurned;
  return {
    date,
    consumed,
    target,
    burned: safeBurned,
    netCalories,
    caloriesRemaining: target.calories - consumed.calories + safeBurned,
    overCalories: netCalories > target.calories,
  };
}
```

`caloriesRemaining = target − food + burned`. Import the wrong number and the
app quietly tells someone to eat several hundred calories more than it should.
Three ways to get this wrong:

1. **Active energy on top of workouts.** Apple's all-day Active Energy already
   includes the workout. Adding both double counts.
2. **Manual plus imported.** Someone logs "Run, 400 kcal" by hand and the Watch
   imports the same run.
3. **Our own workouts echoing back.** Once Phase 2 writes finished workouts
   into HealthKit, the Phase 1 importer will read them back as new workouts
   unless it skips samples whose source bundle identifier is ours.

The recommendation: **only HealthKit *workouts* feed the calorie budget.**
All-day active energy is imported into `healthDays` and shown as information
only. On top of that, dedupe by UUID, skip our own bundle id, and warn (not
silently merge) when a manual entry overlaps an imported workout in time.

That last one is why `startedAt`/`endedAt` are worth adding now rather than
later.

## Phase 2 — start and stop workouts from the app

This is the expensive half, and it is worth being blunt about why.

`HKWorkoutSession` is **watchOS only**. On iOS you can save a workout after the
fact, but you cannot run a live session, and you cannot stream heart rate
during one. Live heart rate comes from `HKLiveWorkoutBuilder`, also watchOS
only. React Native does not run on watchOS — a watch app is SwiftUI, full stop.

So Phase 2 is three pieces of native work:

**1. A watchOS app target.** `@bacons/apple-targets` supports `type: "watch"`,
which generates the target and keeps its Swift source outside `ios/` so
continuous native generation still works. The watch app owns the
`HKWorkoutSession` and the `HKLiveWorkoutBuilder`.

**2. Mirrored sessions** (watchOS 10 / iOS 17 and later), which is exactly the
"start and stop from the app" behaviour:

- The phone calls `HKHealthStore.startWatchApp(with: configuration)`, which
  launches or wakes the watch app in the background.
- The watch creates the session and calls `startMirroringToCompanionDevice()`.
- The phone receives the live session through
  `workoutSessionMirroringStartHandler`, which must be assigned at launch, and
  can then pause, resume and end it — and receive live heart rate and energy.

**3. A custom Expo native module in Swift** to expose start/pause/resume/stop
and a live metrics event stream to JavaScript. The HealthKit JS library does
not do sessions, so this is ours to write and maintain.

Plus the app-side work: a live workout screen (timer, heart rate, calories),
handling the phone being locked or the app backgrounded, and writing the
finished workout to both Convex and HealthKit.

If Phase 2 turns out to be more than we want to take on, there is a smaller
version: the app starts a workout **on the phone only**, times it, and saves it
to HealthKit at the end with `saveWorkoutSample`. No watch app, no live heart
rate, and the Watch does not know a workout is running — so it is honestly a
stopwatch, not a workout. Worth naming as an option, not worth pretending it is
the same feature.

## Suggested order

| Step | What lands | Depends on |
|---|---|---|
| 0 | `eas.json`, dev client, HealthKit entitlement, an installable iOS build | Apple Developer account |
| 1a | Permission request + `services/health` seam + pure mapping and its tests | 0 |
| 1b | Workout import: schema fields, dedupe index, upsert mutation, anchored sync | 1a |
| 1c | `healthDays` table; steps hero module finally shows a real number | 1a |
| 1d | Heart rate and Apple-source badges on workout rows; steps trend on Progress | 1b, 1c |
| 2a | watchOS target building and installing, empty SwiftUI app | 0 |
| 2b | `HKWorkoutSession` + live builder on the watch; native module; mirrored session | 2a |
| 2c | Live workout screen; write finished workouts back to HealthKit and Convex | 2b, 1b |

Steps 1a–1d are ordinary work in this codebase. Step 2 is a native iOS/watchOS
project that happens to live in the same repository.

## Open questions

1. **Is there an Apple Developer account, and is the iOS app actually shipping?**
   Everything here is dead code on the web build, which is what users have today.
2. **Should Apple's burn increase the eating budget?** The current math says
   yes. That is a bigger behavioural change than it looks.
3. **Is Phase 1 enough?** It delivers steps, heart rate and workout calories
   from the Watch. Phase 2 only adds *control*.
4. **Android?** Health Connect is the equivalent and would need its own source
   value in the enum. Out of scope here, but the enum should not be written in
   a way that makes it awkward.
