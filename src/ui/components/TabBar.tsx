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

/** Original FAB was 52px — grow the real diameter 20% (not a Y-translate fake). */
const FAB_SIZE = Math.round(52 * 1.2); // 62
const FAB_ICON = Math.round(28 * 1.2); // 34
/**
 * Previous incorrect lift used a 15px air gap above the bar. Double that as
 * cutout padding between the FAB edge and the nav-bar fill. Screen tabBarSpace
 * stays 96 — page content is not pushed upward.
 */
const CUTOUT_GAP = 15 * 2; // 30
const CUTOUT_SIZE = FAB_SIZE + CUTOUT_GAP * 2; // 122

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
      {left.map(renderTab)}

      {/* flex:1 keeps Diary / Progress evenly spaced with the other tabs. */}
      <View style={styles.fabSlot} pointerEvents="box-none">
        {/*
          Shared anchor at the bar top (half the FAB above the edge — same
          cradle idea as the original 52px / -22 button, scaled to size).
          The floating air gap comes from the enlarged cutout, not from
          translating the button further up into page content.
        */}
        <View style={styles.fabAnchor} pointerEvents="box-none">
          <View
            pointerEvents="none"
            style={[
              styles.cutout,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />

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
  fabAnchor: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // Cradle on the bar top — do not add an extra upward air-gap translate.
    marginTop: -(FAB_SIZE / 2),
    overflow: 'visible',
  },
  /**
   * Page-colored notch concentric with the FAB. CUTOUT_GAP (30) of air between
   * the button edge and the nav-bar fill — larger cutout, same button Y.
   */
  cutout: {
    position: 'absolute',
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE,
    borderRadius: CUTOUT_SIZE / 2,
    top: (FAB_SIZE - CUTOUT_SIZE) / 2,
    left: (FAB_SIZE - CUTOUT_SIZE) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    // Soft elevated shadow — larger blur, soft opacity, subtle downward offset
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
});
