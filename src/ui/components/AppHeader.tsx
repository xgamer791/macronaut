import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayNameFromUser } from '@/services/auth/displayName';
import { useAuth } from '@/state/AuthProvider';
import { useNotifications, useSetting } from '@/state/queries';
import { useSetDrawerPush } from '@/ui/motion/slidePush';
import { SLIDE_DURATION_MS, SLIDE_EASING } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { palette, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

const ICON = '#FFFFFF';
const NOTIFY_DOT = palette.accentDark;
const GLYPH = 22;
const GLYPH_INSET = (touchTarget - GLYPH) / 2;
const PLUS = 30;

export interface AppHeaderProps {
  /** Calendar icon on the right cluster. */
  onCalendarPress?: () => void;
}

/**
 * Garmin-style chrome: hamburger on the left, add / calendar on the right.
 * Profile, chats and notifications live in the tab bar, not here.
 */
export function AppHeader({ onCalendarPress }: AppHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const icon = colors.textPrimary;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      <HeaderHit
        accessibilityLabel="Open menu"
        onPress={() => {
          void Haptics.selectionAsync();
          setMenuOpen(true);
        }}
      >
        <Ionicons name="menu-outline" size={GLYPH} color={icon} />
      </HeaderHit>

      <View style={styles.cluster}>
        <HeaderHit
          accessibilityLabel="Add food"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/add');
          }}
          slot={PLUS}
        >
          <Ionicons name="add" size={PLUS} color={icon} />
        </HeaderHit>

        <HeaderHit
          accessibilityLabel="Open calendar"
          onPress={() => {
            void Haptics.selectionAsync();
            onCalendarPress?.();
          }}
        >
          <Ionicons name="calendar-outline" size={GLYPH} color={icon} />
        </HeaderHit>
      </View>

      <HeaderMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

type MenuItem = {
  href: Href;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MENU_ITEMS: MenuItem[] = [
  { href: '/settings', label: 'Settings', icon: 'settings-outline' },
  { href: '/meals', label: 'Meals', icon: 'restaurant-outline' },
  { href: '/goals', label: 'Goals', icon: 'flag-outline' },
  { href: '/apple-health', label: 'Apple Health', icon: 'heart-outline' },
  { href: '/privacy', label: 'Privacy Policy', icon: 'shield-outline' },
  { href: '/terms', label: 'Terms of Service', icon: 'document-text-outline' },
];

function HeaderMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(Math.round((width || 390) * 0.86), 360);
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const [webOpen, setWebOpen] = useState(false);
  const progress = useSharedValue(0);
  const setDrawer = useSetDrawerPush();

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    setWebOpen(false);
    if (visible) setMounted(true);
  }

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !mounted || !visible) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setWebOpen(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mounted, visible]);

  const drawerOpen = Platform.OS === 'web' ? webOpen : visible;
  useLayoutEffect(() => {
    if (!mounted) {
      setDrawer(null);
      return;
    }
    setDrawer({ width: panelWidth, open: drawerOpen });
    return () => setDrawer(null);
  }, [drawerOpen, mounted, panelWidth, setDrawer]);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: SLIDE_DURATION_MS,
        easing: SLIDE_EASING,
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(0, {
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
    });
    const id = setTimeout(() => setMounted(false), SLIDE_DURATION_MS);
    return () => clearTimeout(id);
  }, [mounted, progress, visible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * panelWidth }],
  }));

  if (!mounted) return null;

  const open = Platform.OS === 'web' ? webOpen : visible;
  const webRoot =
    Platform.OS === 'web' ? { dataSet: { headermenu: open ? 'open' : 'shut' } } : null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.menuRoot} pointerEvents="box-none" {...webRoot}>
        <Animated.View
          {...(Platform.OS === 'web' ? { dataSet: { menudrawer: '' } } : null)}
          style={[
            styles.drawer,
            {
              width: panelWidth,
              paddingTop: insets.top + spacing.sm,
              paddingBottom: insets.bottom + spacing.lg,
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
            },
            Platform.OS === 'web'
              ? { transform: [{ translateX: open ? 0 : -panelWidth }] }
              : drawerStyle,
          ]}
        >
          <View style={styles.menuHeading}>
            <AppText variant="heading" weight="600">
              Menu
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={onClose}
              hitSlop={8}
              style={styles.menuClose}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onClose();
                router.push(item.href);
              }}
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Ionicons name={item.icon} size={22} color={colors.textPrimary} />
              <AppText weight="600">{item.label}</AppText>
            </Pressable>
          ))}
        </Animated.View>
        <Pressable
          {...(Platform.OS === 'web' ? { dataSet: { menuscrim: '' } } : null)}
          style={styles.menuClosePage}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </View>
    </Modal>
  );
}

/** Same 32px circular account picture as Today — photo when the account
 * has one, initials otherwise. */
export function HeaderAvatarButton() {
  const router = useRouter();
  const { user } = useAuth();
  const savedName = useSetting<string>('displayName', '');
  const displayName = savedName.data || displayNameFromUser(user);
  const initials = useMemo(
    () => initialsFrom(displayName, user?.email),
    [displayName, user?.email],
  );
  const avatarUri = user?.image?.trim() || undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
      onPress={() => {
        void Haptics.selectionAsync();
        router.push('/profile');
      }}
      hitSlop={4}
      style={styles.hit}
    >
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.avatarFallback}>
          {initials ? (
            <AppText style={styles.initials}>{initials}</AppText>
          ) : (
            <Ionicons name="person" size={16} color={ICON} />
          )}
        </View>
      )}
    </Pressable>
  );
}

export function HeaderNotifyButton({ notifyDot }: { notifyDot?: boolean }) {
  const router = useRouter();
  const { signedIn } = useAuth();
  const notifications = useNotifications();
  const unreadCount = notifications.data?.unreadCount ?? 0;
  const active = notifyDot ?? unreadCount > 0;

  return (
    <HeaderHit
      accessibilityLabel={active ? `${unreadCount || 'New'} unread notifications` : 'Notifications'}
      onPress={() => {
        void Haptics.selectionAsync();
        router.push(signedIn ? '/notifications' : '/login');
      }}
      dot={active}
    >
      <Ionicons
        name={active ? 'notifications' : 'notifications-outline'}
        size={GLYPH}
        color={ICON}
      />
    </HeaderHit>
  );
}

/** Direct messages. Signed-out visitors are sent through sign-in first. */
export function HeaderChatsButton() {
  const router = useRouter();
  const { signedIn } = useAuth();

  return (
    <HeaderHit
      accessibilityLabel="Open chats"
      onPress={() => {
        void Haptics.selectionAsync();
        router.push(signedIn ? '/chats' : '/login');
      }}
    >
      <Ionicons name="chatbubbles-outline" size={GLYPH + 1} color={ICON} />
    </HeaderHit>
  );
}

function HeaderHit({
  children,
  accessibilityLabel,
  onPress,
  disabled,
  dot,
  dotColor = NOTIFY_DOT,
  slot = GLYPH,
}: {
  children: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  dot?: boolean;
  dotColor?: string;
  /** Size of the centered content box. Defaults to the shared glyph size. */
  slot?: number;
}) {
  const inset = (touchTarget - slot) / 2;
  // Sit the badge on the 45° point of the slot, which is the edge of a
  // circular one rather than the empty corner outside it.
  const dotOffset = inset + (slot / 2) * (1 - Math.SQRT1_2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={styles.hit}
    >
      <View
        style={[styles.glyphSlot, { top: inset, left: inset, width: slot, height: slot }]}
        pointerEvents="none"
      >
        {children}
      </View>
      {dot ? (
        <View
          style={[styles.dot, { top: dotOffset, right: dotOffset, backgroundColor: dotColor }]}
        />
      ) : null}
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

const AVATAR = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: touchTarget,
    marginTop: 3,
  },
  menuRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  drawer: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  menuClosePage: {
    flex: 1,
  },
  menuHeading: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  menuClose: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  menuRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    height: touchTarget,
    gap: spacing.xs,
  },
  hit: {
    width: touchTarget,
    height: touchTarget,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphSlot: {
    position: 'absolute',
    top: GLYPH_INSET,
    left: GLYPH_INSET,
    width: GLYPH,
    height: GLYPH,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: ICON,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: -3.5,
    marginRight: -3.5,
    backgroundColor: NOTIFY_DOT,
    zIndex: 1,
  },
});
