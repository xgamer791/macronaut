/** In-app pause note for Apple Health / Watch. The website cannot talk to
 * HealthKit, so this work stops until an iOS build is on a real device. */

export const APPLE_HEALTH_STATUS_UPDATED = '3 September 2026';

export const APPLE_HEALTH_DONE = [
  'Wrote the plan (docs/apple-health.md) and the Apple-side checklist (docs/ios-setup.md).',
  'Added eas.json and the HealthKit config plugin. A local prebuild already produces the HealthKit entitlement and the two usage strings in Info.plist.',
  'Activity rows already accept sourceType healthkit / apple_watch and an optional sourceId, so imported workouts can reuse the existing table.',
  'The Today steps tile is built, but nothing writes a step count yet, so it always shows zero.',
] as const;

export const APPLE_HEALTH_TODO = [
  'Turn on HealthKit for App ID com.mangomarketeers.macronaut. Send the Apple Team ID, Apple ID email, Expo account (or eas init project id), App Store Connect app id if one exists, and iPhone + Watch models and OS versions.',
  'Link Expo, put the project id in app.config.ts, and install a development build on a real iPhone. HealthKit does not run on GitHub Pages or in Expo Go.',
  'Read Watch workouts, daily steps, and workout heart rate from HealthKit. Only imported workouts should raise the calorie budget — do not add all-day Active Energy on top, or people get told to eat extra.',
  'If we still want start/stop from the app: a SwiftUI watch app plus a small native module. That needs iOS 17+ and watchOS 10+.',
  'Update the privacy policy for Health data, then TestFlight.',
] as const;
