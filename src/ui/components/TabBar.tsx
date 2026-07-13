import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, View } from 'react-native';
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
        style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm }}
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.sm,
      }}
    >
      {left.map(renderTab)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add food"
          onPress={() => router.push('/add')}
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -22,
            opacity: pressed ? 0.85 : 1,
            borderWidth: 3,
            borderColor: colors.background,
          })}
        >
          <Ionicons name="add" size={28} color={colors.onAccent} />
        </Pressable>
      </View>
      {right.map(renderTab)}
    </View>
  );
}
