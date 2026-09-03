import type { ExpoConfig } from 'expo/config';

// When building for GitHub Pages the app is served from /macronaut/, so the
// exported bundle needs a matching baseUrl. Local dev and native builds are
// unaffected (EXPO_PUBLIC_BASE_PATH is only set in the deploy workflow).
const basePath = process.env.EXPO_PUBLIC_BASE_PATH ?? '';

const config: ExpoConfig = {
  name: 'Macronaut',
  slug: 'macronaut',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'macronaut',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    // `com.macronaut.app` was not available to register with Apple, so the App
    // ID (and this bundle id with it) is the Mango Marketeers one.
    bundleIdentifier: 'com.mangomarketeers.macronaut',
    supportsTablet: false,
    // Adds the `com.apple.developer.applesignin` entitlement, which
    // expo-apple-authentication needs and which App Store review requires now
    // that the login screen offers Google as well. The Services ID used by the
    // web flow (`com.mangomarketeers.macronaut.web`) must have this bundle id as
    // its primary App ID so both give the same Apple user id — see
    // docs/accounts.md.
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        'Macronaut uses the camera to scan barcodes and photograph meals for AI food logging.',
    },
  },
  android: {
    package: 'com.macronaut.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-apple-authentication',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#101418',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Macronaut uses the camera to scan barcodes and photograph meals for AI food logging.',
      },
    ],
    [
      // Adds the `com.apple.developer.healthkit` entitlement, so the App ID
      // needs the HealthKit capability before a build can be signed — see
      // docs/ios-setup.md. iOS only; the web and Android builds never load the
      // native module.
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Macronaut reads your steps, heart rate and workout calories from Apple Health so your activity and calorie budget stay in sync with your Apple Watch.',
        NSHealthUpdateUsageDescription:
          'Macronaut saves workouts you start in the app to Apple Health so they count towards your activity rings.',
        // The plugin adds the background-delivery entitlement unless this is
        // false. Kept on so enabling background sync later does not need a new
        // provisioning profile; no `UIBackgroundModes` is claimed until we
        // actually observe changes in the background.
        background: true,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    baseUrl: basePath,
  },
};

export default config;
