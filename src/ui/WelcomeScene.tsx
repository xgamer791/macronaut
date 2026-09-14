import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { lightColors } from '@/ui/theme/tokens';
import { getWelcomeLayout, WELCOME_SCRIM } from '@/ui/welcomeMedia';

/** Shared authentication backdrop. Each focused route claims the same web
 * player, preserving its playback position through forward/back navigation.
 * Forms scroll independently; opening the keyboard never shrinks the film
 * into a short strip. Apple Health and personalization do not use this shell. */
export function WelcomeScene({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const layout = getWelcomeLayout(width, height);

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { width: layout.width }]}>
        <View pointerEvents="none" style={[styles.media, { minHeight: layout.minHeight }]}>
          <WelcomeBackground />
          <View style={styles.scrim} />
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.background },
  canvas: { flex: 1, alignSelf: 'center', overflow: 'hidden', backgroundColor: '#101418' },
  media: { ...StyleSheet.absoluteFill },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: WELCOME_SCRIM },
  content: { flex: 1, zIndex: 1 },
});
