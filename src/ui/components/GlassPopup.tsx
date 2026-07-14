import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { LiquidGlassCard } from './LiquidGlassCard';

const SPRING = { damping: 20, stiffness: 280, mass: 0.8 };

export interface GlassPopupProps {
  visible: boolean;
  onClose: () => void;
  /** Distance from top of screen for the card (calendar-style). Omit to center. */
  top?: number;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

/** Floating liquid-glass popup — same scrim + spring + glass shell as the calendar. */
export function GlassPopup({
  visible,
  onClose,
  top,
  children,
  accessibilityLabel = 'Dismiss',
}: GlassPopupProps) {
  const { colors } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const progress = useSharedValue(0);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withSpring(1, SPRING);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, progress, mounted]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-6, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.98, 1]) },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          />
        </View>
        <Animated.View
          pointerEvents="box-none"
          style={[
            top != null ? { marginTop: top } : styles.centered,
            cardStyle,
          ]}
        >
          <LiquidGlassCard>{children}</LiquidGlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
});
