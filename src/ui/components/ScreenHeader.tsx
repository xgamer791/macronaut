import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { goBackOrHome } from '@/utils/navigation';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface ScreenHeaderProps {
  /** Centered page title (MyFitnessPal-style). */
  title?: string;
  /** Optional trailing control (favorite, etc.). Mirrored width keeps the title centered. */
  right?: React.ReactNode;
  /** Override back action. Defaults to goBackOrHome. */
  onBack?: () => void;
}

/**
 * Stack-screen chrome: back arrow on the left, title centered, optional right slot.
 * Tab roots should not use this — only pages you can navigate away from.
 */
export function ScreenHeader({ title, right, onBack }: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack ?? (() => goBackOrHome(router))}
          hitSlop={8}
          style={styles.backHit}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.titleWrap} pointerEvents="none">
        {title ? (
          <AppText variant="title" weight="600" display numberOfLines={1} align="center">
            {title}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
  },
  side: {
    width: touchTarget,
    minHeight: touchTarget,
    justifyContent: 'center',
    zIndex: 1,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  backHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
