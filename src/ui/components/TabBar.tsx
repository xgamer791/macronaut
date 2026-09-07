import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { usePathname, useRouter, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { MessagesSquare, Users, type LucideIcon } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayNameFromUser } from '@/services/auth/displayName';
import { useAuth } from '@/state/AuthProvider';
import { useMyProfile, useSetting } from '@/state/queries';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

type IconName = keyof typeof Ionicons.glyphMap;
type TabGlyphName = IconName | LucideIcon;

type TabItem =
  | {
      kind: 'tab';
      name: string;
      label: string;
      icon: IconName;
      iconActive: IconName;
      comingSoon?: boolean;
    }
  | {
      kind: 'link';
      href: Href;
      label: string;
      icon: TabGlyphName;
      iconActive: TabGlyphName;
    }
  | { kind: 'profile' };

/** Today, chats, friends, groups, then the account picture. Meals,
 * Progress and Settings stay registered as hidden tabs so existing links work. */
const ITEMS: TabItem[] = [
  { kind: 'tab', name: 'index', label: 'Today', icon: 'home-outline', iconActive: 'home' },
  {
    kind: 'link',
    href: '/chats',
    label: 'Chats',
    icon: MessagesSquare,
    iconActive: MessagesSquare,
  },
  {
    kind: 'link',
    href: '/friends',
    label: 'Friends',
    icon: Users,
    iconActive: Users,
  },
  {
    kind: 'link',
    href: '/groups',
    label: 'Groups',
    icon: 'people-circle-outline',
    iconActive: 'people-circle',
  },
  { kind: 'profile' },
];

const ICON = 27;
/** Same circular picture the Today header used to show. */
const AVATAR = 32;

function TabGlyph({ name, color }: { name: TabGlyphName; color: string }) {
  if (typeof name === 'string') {
    return <Ionicons name={name} size={ICON} color={color} />;
  }
  const Lucide = name;
  return <Lucide size={ICON} color={color} />;
}

const PRIMARY_TAB_PATHS = new Set(['/', '/meals', '/progress', '/settings']);

export function isPrimaryTabPath(pathname: string) {
  return PRIMARY_TAB_PATHS.has(pathname);
}

/** Bottom tab bar. Icons only — labels stay on the accessibility name. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const pathname = usePathname();

  // Stack pages get the copy mounted beside the root navigator so they cannot
  // cover it. Hiding this copy also prevents the two bars from overlapping.
  if (!isPrimaryTabPath(pathname)) return null;

  return <TabBarItems state={state} navigation={navigation} />;
}

/** Footer used outside the tab navigator, beneath signed-in stack pages. */
export function PersistentTabBar() {
  return <TabBarItems />;
}

function TabBarItems({
  state,
  navigation,
}: Partial<Pick<BottomTabBarProps, 'state' | 'navigation'>>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.chrome,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {ITEMS.map((item) => {
        if (item.kind === 'profile') {
          return <ProfileTab key="profile" />;
        }

        if (item.kind === 'link') {
          const active = pathname === item.href;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push(item.href);
              }}
              style={styles.tab}
            >
              <View>
                <TabGlyph
                  name={active ? item.iconActive : item.icon}
                  color={active ? colors.accent : colors.textMuted}
                />
              </View>
            </Pressable>
          );
        }

        const route = state?.routes.find((r) => r.name === item.name);
        const routeIndex = route ? state?.routes.findIndex((r) => r.key === route.key) : -1;
        const focused =
          routeIndex !== undefined &&
          routeIndex >= 0 &&
          state?.index === routeIndex &&
          !item.comingSoon;

        const icon = (
          <Ionicons
            name={focused ? item.iconActive : item.icon}
            size={ICON}
            color={focused ? colors.accent : colors.textMuted}
          />
        );

        if (item.comingSoon || !route) {
          if (!item.comingSoon && !state && !navigation) {
            const active = pathname === '/';
            return (
              <Pressable
                key={item.name}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.replace('/');
                }}
                style={styles.tab}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={ICON}
                  color={active ? colors.accent : colors.textMuted}
                />
              </Pressable>
            );
          }

          return (
            <View
              key={item.name}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label}, coming soon`}
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
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation!.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation!.navigate(item.name);
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

function ProfileTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const profile = useMyProfile();
  const savedName = useSetting<string>('displayName', '');
  const displayName = profile.data?.displayName || savedName.data || displayNameFromUser(user);
  const initials = useMemo(
    () => initialsFrom(displayName, user?.email),
    [displayName, user?.email],
  );
  const avatarUri = profile.data?.avatarUrl?.trim() || user?.image?.trim() || undefined;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel="Open your profile"
      onPress={() => {
        void Haptics.selectionAsync();
        router.push('/profile');
      }}
      style={styles.tab}
    >
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: colors.surfaceRaised }]}>
          {initials ? (
            <AppText style={styles.initials}>{initials}</AppText>
          ) : (
            <Ionicons name="person" size={16} color={colors.textMuted} />
          )}
        </View>
      )}
    </Pressable>
  );
}

function initialsFrom(name?: string | null, email?: string): string {
  const trimmed = (name ?? '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const local = email?.split('@')[0];
  if (local) return local.charAt(0).toUpperCase();
  return '';
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
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarFallback: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
  },
});
