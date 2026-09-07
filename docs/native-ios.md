# After the native iOS app — the to-do list

Status: **waiting on a native build.** Everything below is blocked on the same
thing: the live product is a website on GitHub Pages, and each of these needs
an iOS app on a real device before it can be finished.

This file is the list. When Macronaut becomes a native iOS app, work through
it. Nothing here is a bug — each item is deliberately parked, with the UI
already built so the wiring is the only thing left.

## Why these are parked together

A website cannot do any of it:

- **HealthKit does not exist outside a native app.** Not in a browser, not in
  Expo Go.
- **Push needs a device token**, an APNs key, and an app that can hold both. A
  Pages deploy has nowhere to put one.

So the pattern is the same in each case: the interface ships now and says
plainly that it is not live, and stores whatever the person chose so the
native build can pick it up without asking again.

---

## 1. Apple Health and Apple Watch

The plan and the Apple-side checklist are already written — do not re-plan
this, read them:

- `docs/apple-health.md` — the plan, and why reading Health data and
  *starting* a workout from the app are two different projects.
- `docs/ios-setup.md` — the Apple-side checklist.
- `src/utils/appleHealthStatus.ts` — `APPLE_HEALTH_DONE` and
  `APPLE_HEALTH_TODO`, rendered in the app at `/apple-health`.

**Already in the repo:** `eas.json`, the HealthKit config plugin (a local
prebuild produces the entitlement and both usage strings), activity rows that
accept `sourceType: healthkit | apple_watch` with an optional `sourceId`, and
the Today steps tile — which shows zero, because nothing writes a step count
yet.

**Still needed:** turn on HealthKit for the App ID, link Expo and install a
development build on a real iPhone, then read Watch workouts, daily steps and
workout heart rate. One trap worth repeating: only imported *workouts* should
raise the calorie budget. Adding all-day Active Energy on top tells people to
eat extra.

`isAppleWatchConnected()` returns `false` today, which is what keeps the
header Watch LED showing disconnected. That is the switch to flip.

## 2. Push notifications

**Already in the repo:**

- The opt-in row at the top of Notifications
  (`src/ui/components/NotificationOptIn.tsx`) — a switch in the app's own list
  language, written as a control rather than a promotion, so there is nothing
  to dismiss. Its status line is the honest part: off offers what push would
  carry, on says the phone will ask once the iOS app exists.
- `src/utils/pushNotificationStatus.ts` — `isPushNotificationsLive()` returns
  `false`, plus `PUSH_WANTED_SETTING`.
- The switch stores `pushNotificationsWanted`, an ordinary account setting, so
  it is already synced per account and readable from the native build.
- The events themselves already exist and are durable: `friend_request`,
  `friend_accepted` and `chat_message` rows in the `notifications` table,
  written by `convex/notifications.ts`. Push does not need new events — it
  needs a transport for the ones there.

**Still needed:**

1. An APNs key and the push capability on App ID
   `com.mangomarketeers.macronaut`.
2. `expo-notifications` in the dev build: ask for permission, get the Expo
   push token, store it against the account. Anyone who already flipped the
   switch has said yes once — do not ask them again, just request the OS
   permission.
3. Send on the three existing events. `addChatNotification`,
   `addFriendRequestNotification` and `addFriendAcceptedNotification` in
   `convex/notifications.ts` are the three places a push belongs; they are
   already the single funnel every event goes through.
4. Respect the unread state that already exists — opening a chat calls
   `markChatNotificationsRead`, so a badge should follow `unreadCount` from
   `notifications.list` rather than counting separately.
5. Flip `isPushNotificationsLive()` to a real permission check. The row
   hides itself once it returns true, since there is nothing left to ask.
6. Update the privacy policy for push tokens before TestFlight.

## 3. While you are in there

Small things that are only reachable from a native build, worth doing in the
same pass rather than as their own trip:

- Sign in with Apple already has its native path
  (`convex/AppleNative.ts`); confirm it on a real device, since it has only
  ever run through the web OAuth round trip.
- The barcode scanner uses `expo-camera` and is only exercised on the web
  build's manual-entry fallback today.

---

Last updated 7 September 2026.
