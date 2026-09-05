import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';

const STILL = require('../../assets/images/signup-health-watch.png');

/** Grok still at native 1024×1536. Rendered inside the gap between the
 * heading and the Connect copy so the watch is never cropped over type.
 * Welcome and the other create-account screens keep the video. */
export function SignupHealthBackground() {
  return (
    <Image
      source={STILL}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      contentPosition="center"
    />
  );
}
