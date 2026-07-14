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
    bundleIdentifier: 'com.macronaut.app',
    supportsTablet: false,
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
    'expo-sqlite',
    'expo-font',
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
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    baseUrl: basePath,
  },
};

export default config;
