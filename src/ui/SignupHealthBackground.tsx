import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const STILL = require('../../assets/images/signup-health-watch.png');

/** Grok still at native 1024×1536. Full-bleed behind the Apple Health ask.
 * Position is baked into the still — no JS height math, so the first
 * paint matches the settled frame. Welcome and the other create-account
 * screens keep the video. */
export function SignupHealthBackground() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={STILL}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
      />
    </View>
  );
}
