import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

const STILL = require('../../assets/images/signup-health-watch.png');

/** Drop the still so the watch sits in the open middle, not under the
 * header. The still itself places the watch high in the frame. */
const WATCH_SHIFT = 0.08;

/** Grok still at native 1024×1536. Full-bleed behind the Apple Health ask.
 * Welcome and the other create-account screens keep the video. */
export function SignupHealthBackground() {
  const { height } = useWindowDimensions();
  const shift = Math.round(height * WATCH_SHIFT);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={STILL}
        style={[StyleSheet.absoluteFill, { top: shift, bottom: -shift }]}
        contentFit="cover"
        contentPosition="center"
      />
    </View>
  );
}
