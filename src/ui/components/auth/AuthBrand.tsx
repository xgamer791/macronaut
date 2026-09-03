import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/ui/components/AppText';
import { fonts } from '@/ui/theme/tokens';
import { BarbellMMark } from './icons';
import { authColors } from './theme';

/** Logo, wordmark and a line under it. The line is the one thing the two
 * screens say differently. */
export function AuthBrand({ tagline }: { tagline: string }) {
  return (
    <View style={styles.brand}>
      <BarbellMMark />
      <AppText style={styles.wordmark}>MacroNaught</AppText>
      <AppText style={styles.tagline}>{tagline}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: authColors.navy,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.displayMedium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: authColors.navySoft,
    textAlign: 'center',
  },
});
