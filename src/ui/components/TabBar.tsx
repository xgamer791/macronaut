import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta = {
  label: string;
  icon: IconName;
  iconActive: IconName;
  /** Shown in the bar but not navigable while the screen is still being built. */
  comingSoon?: boolean;
};

const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Today', icon: 'home-outline', iconActive: 'home' },
  meals: { label: 'Meals', icon: 'restaurant-outline', iconActive: 'restaurant' },
  progress: {
    label: 'Groups',
    icon: 'people-outline',
    iconActive: 'people',
    comingSoon: true,
  },
  settings: { label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
};

/** Bottom tab bar. Icons only — labels stay on the accessibility name. */
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
        const focused = state.index === routeIndex && !meta.comingSoon;

        const icon = (
          <Ionicons
            name={focused ? meta.iconActive : meta.icon}
            size={23}
            color={focused ? colors.accent : colors.textMuted}
          />
        );

        if (meta.comingSoon) {
          return (
            <View
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={`${meta.label}, coming soon`}
              accessibilityState={{ selected: false, disabled: true }}
              style={styles.tab}
            >
              {icon}
            </View>
          );
        }

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
            {icon}
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
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
