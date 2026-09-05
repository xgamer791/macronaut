import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const STILL = require('../../assets/images/signup-health-watch.png');

/** Grok still at native 1024×1536. Full-bleed behind the Apple Health ask
 * so the watch sits just above center and the copy can wrap it. Welcome
 * and the other create-account screens keep the video. */
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
