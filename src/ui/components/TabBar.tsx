import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Today', icon: 'home-outline', iconActive: 'home' },
  diary: { label: 'Diary', icon: 'book-outline', iconActive: 'book' },
  progress: { label: 'Progress', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  settings: { label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
};

/** Keep the enlarged Add Meal FAB (20% over the original 52px). */
const FAB_SIZE = Math.round(52 * 1.2); // 62
const FAB_ICON = Math.round(28 * 1.2); // 34
/** Exact air gap between FAB edge and nav-bar fill where they meet. */
const CUTOUT_GAP = 10;
/** Tight cradle diameter — only ~10px beyond the green button. */
const CUTOUT_SIZE = FAB_SIZE + CUTOUT_GAP * 2; // 82
/** How deep the U-notch dips into the bar (half-circle below the top edge). */
const NOTCH_DEPTH = CUTOUT_SIZE / 2; // 41

/** Bottom tab bar with a center Add FAB that opens the add-food hub. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const routes = state.routes.filter((r) => TAB_META[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route: (typeof routes)[number]) => {
    const meta = TAB_META[route.name];
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === routeIndex;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        style={styles.tab}
      >
        <Ionicons
          name={focused ? meta.iconActive : meta.icon}
          size={22}
          color={focused ? colors.accent : colors.textMuted}
        />
        <AppText variant="micro" tone={focused ? 'accent' : 'muted'} weight={focused ? '600' : '400'}>
          {meta.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/*
        Shallow U-notch: a page-colored circle centered on the bar top, clipped
        so only the portion inside the bar is visible. No halo above the bar.
      */}
      <View style={styles.notchClip} pointerEvents="none">
        <View style={[styles.notchCircle, { backgroundColor: colors.background }]} />
      </View>

      {left.map(renderTab)}

      <View style={styles.fabSlot} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add food"
          onPress={() => router.push('/add')}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.accent,
              shadowColor: '#000',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Ionicons name="add" size={FAB_ICON} color={colors.onAccent} />
        </Pressable>
      </View>

      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    overflow: 'visible',
    zIndex: 20,
  },
  /**
   * Clips the cradle circle to the bar interior so the notch is a smooth U
   * hugging the FAB — never a full dark disc floating over page content.
   */
  notchClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NOTCH_DEPTH,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  notchCircle: {
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE,
    borderRadius: CUTOUT_SIZE / 2,
    // Center on the bar top edge; upper half is clipped away by notchClip.
    marginTop: -NOTCH_DEPTH,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    zIndex: 3,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Same cradle anchor as before — half above the bar top, not lifted further.
    marginTop: -(FAB_SIZE / 2),
    zIndex: 2,
    // Soft shadow for float depth (replaces the old oversized dark halo).
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
