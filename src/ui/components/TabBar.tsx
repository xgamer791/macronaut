import { Ionicons } from '@expo/vector-icons';
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
  meals: { label: 'Meals', icon: 'restaurant-outline', iconActive: 'restaurant' },
  progress: { label: 'Progress', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  settings: { label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
};

/** Bottom tab bar. Add food lives on the Today header plus, not here. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const routes = state.routes.filter((r) => TAB_META[r.name]);

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
      {routes.map((route) => {
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
            <AppText
              variant="micro"
              tone={focused ? 'accent' : 'muted'}
              weight={focused ? '600' : '400'}
            >
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
});
