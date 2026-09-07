import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { displayNameFromUser } from '@/services/auth/displayName';
import { useAuth } from '@/state/AuthProvider';
import { keys, useSetting } from '@/state/queries';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

const WATCH_FACE = require('../../../assets/images/header-watch.png');

const ICON = '#FFFFFF';
const DOT = '#2EE66A';
const GLYPH = 22;
const GLYPH_INSET = (touchTarget - GLYPH) / 2;

export interface AppHeaderProps {
  /** Bell action. Defaults to opening the calendar when provided by Today. */
  onBellPress?: () => void;
  /** Show the notification badge on the bell. */
  notifyDot?: boolean;
}

/**
 * Garmin-style chrome: avatar + bell on the left, add / sync / watch on the right.
 * White icons — sits over the Today hero or any dark surface.
 */
export function AppHeader({ onBellPress, notifyDot = true }: AppHeaderProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const savedName = useSetting<string>('displayName', '');
  const [syncing, setSyncing] = useState(false);
  const spin = useSharedValue(0);

  const displayName = savedName.data || displayNameFromUser(user);
  const initials = useMemo(() => initialsFrom(displayName, user?.email), [displayName, user?.email]);
  const avatarUri = user?.image?.trim() || undefined;

  const syncStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  async function onSync() {
    if (syncing) return;
    setSyncing(true);
    void Haptics.selectionAsync();
    spin.value = withTiming(spin.value + 1, { duration: 650, easing: Easing.linear });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['diary'] }),
      qc.invalidateQueries({ queryKey: ['diary-range'] }),
      qc.invalidateQueries({ queryKey: ['activity'] }),
      qc.invalidateQueries({ queryKey: ['activity-range'] }),
      qc.invalidateQueries({ queryKey: ['day-notes'] }),
      qc.invalidateQueries({ queryKey: keys.goals }),
    ]);
    setSyncing(false);
  }

  return (
    <View style={styles.row}>
      <View style={styles.cluster}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/settings');
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

        <HeaderHit
          accessibilityLabel="Notifications"
          onPress={() => {
            void Haptics.selectionAsync();
            onBellPress?.();
          }}
          dot={notifyDot}
        >
          <Ionicons name="notifications" size={GLYPH} color={ICON} />
        </HeaderHit>
      </View>

      <View style={styles.cluster}>
        <HeaderHit
          accessibilityLabel="Add food"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/add');
          }}
        >
          <Ionicons name="add" size={GLYPH} color={ICON} />
        </HeaderHit>

        <HeaderHit
          accessibilityLabel="Sync data"
          disabled={syncing}
          onPress={() => {
            void onSync();
          }}
        >
          <Animated.View style={syncStyle}>
            <Ionicons name="sync" size={GLYPH} color={ICON} />
          </Animated.View>
        </HeaderHit>

        <HeaderHit
          accessibilityLabel="Apple Watch and Apple Health"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/apple-health');
          }}
          dot
        >
          <View style={styles.watch}>
            <Image
              source={WATCH_FACE}
              style={styles.watchImg}
              contentFit="cover"
              contentPosition="center"
            />
          </View>
        </HeaderHit>
      </View>
    </View>
  );
}

function HeaderHit({
  children,
  accessibilityLabel,
  onPress,
  disabled,
  dot,
}: {
  children: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  dot?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={styles.hit}
    >
      <View style={styles.glyphSlot} pointerEvents="none">
        {children}
      </View>
      {dot ? <View style={styles.dot} /> : null}
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
  watch: {
    width: GLYPH,
    height: GLYPH,
    borderRadius: GLYPH / 2,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  watchImg: {
    width: GLYPH,
    height: GLYPH,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DOT,
    zIndex: 1,
  },
});
