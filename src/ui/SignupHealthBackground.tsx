import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';

const STILL = require('../../assets/images/signup-health-watch.png');

/** Full-bleed still behind the Apple Health ask. */
export function SignupHealthBackground() {
  return <Image source={STILL} style={StyleSheet.absoluteFill} contentFit="cover" />;
}
