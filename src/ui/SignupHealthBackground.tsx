import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const STILL = require('../../assets/images/signup-health-watch.png');

/** Grok still, kept at the generated 1024×1536. Only the Apple Health ask
 * uses this — welcome and the other create-account screens keep the video. */
export function SignupHealthBackground() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={STILL} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}
