import { usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WELCOME_VIDEO_KEEP, WELCOME_VIDEO_SHOW, welcomeFlowSegment } from '@/ui/welcomeFlow';

const SHOW = new Set<string>(WELCOME_VIDEO_SHOW);
const KEEP = new Set<string>(WELCOME_VIDEO_KEEP);

/** One video behind the create-account stack. Screens change; this does not. */
export function PersistentWelcomeBackground() {
  const pathname = usePathname();
  const segment = welcomeFlowSegment(pathname);
  const show = SHOW.has(segment);
  const keep = KEEP.has(segment);
  const [started, setStarted] = useState(show);

  useEffect(() => {
    if (show) setStarted(true);
    if (!keep) setStarted(false);
  }, [show, keep]);

  if (!started || !keep) return null;

  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, !show && styles.hidden]}
    >
      <WelcomeBackground />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
});
