import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProfileView } from '@/repositories/profileRepo';
import { followerLabel, followingLabel, postLabel, profileStatLine } from '@/utils/compactCount';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { HeaderAvatarButton, HeaderChatsButton, HeaderNotifyButton } from './AppHeader';
import { AppText } from './AppText';

const AVATAR = 92;
/** How far the avatar hangs below the banner, as in the reference layout. */
const AVATAR_DROP = 44;

type IconName = keyof typeof Ionicons.glyphMap;

export interface ProfileHeaderProps {
  profile: ProfileView;
  onBack: () => void;
  /** False when the page lifts the navigation chrome into the sticky header. */
  showChrome?: boolean;
  /** Trailing control on the identity row — the small gear on your own page. */
  right?: React.ReactNode;
  /** Owner-only: tapping the picture or the banner replaces it. */
  onPickAvatar?: () => void;
  onPickBanner?: () => void;
  /** Which image is mid-upload, so its tap target shows a spinner. */
  uploading?: 'avatar' | 'banner' | null;
  /** Open the follower and following lists. Supplied together or not at all:
   * without them the stat line is plain text, which is what a page with
   * nowhere to send the tap wants. */
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
}

/**
 * Banner, overlapping picture, name, metadata and bio — the top of a profile
 * page. Shared by your own page and by a public one; the editing affordances
 * only appear when the pick handlers are supplied.
 *
 * Inline chrome over the banner is fixed white rather than themed, because it
 * sits on a photo the user chose. The sticky header uses the page theme.
 */
export function ProfileHeader({
  profile,
  onBack,
  showChrome = true,
  right,
  onPickAvatar,
  onPickBanner,
  uploading,
  onOpenFollowers,
  onOpenFollowing,
}: ProfileHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bannerHeight = Math.round(width * 0.46);

  const name = profile.displayName?.trim() || `@${profile.handle}`;
  const editable = Boolean(onPickBanner);

  return (
    <View>
      <Pressable
        accessibilityRole={editable ? 'button' : undefined}
        accessibilityLabel={editable ? 'Change your banner photo' : undefined}
        disabled={!editable}
        onPress={onPickBanner}
        style={{ height: bannerHeight + (showChrome ? insets.top : 0) }}
      >
        {profile.bannerUrl ? (
          <Image
            source={{ uri: profile.bannerUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceRaised }]} />
        )}
        <LinearGradient
          colors={['rgba(6,9,12,0.55)', 'rgba(6,9,12,0.05)', 'rgba(6,9,12,0.55)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {!profile.bannerUrl && editable ? (
          <View style={styles.bannerHint} pointerEvents="none">
            <Ionicons name="image-outline" size={20} color="#FFFFFF" />
            <AppText variant="caption" weight="600" style={styles.onPhoto}>
              Add a banner photo
            </AppText>
          </View>
        ) : null}

        {uploading === 'banner' ? (
          <View style={[StyleSheet.absoluteFill, styles.uploadScrim]} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>

      {showChrome ? (
        <View style={[styles.chrome, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          <ProfileHeaderChrome onBack={onBack} />
        </View>
      ) : null}

      <View style={[styles.identity, { marginTop: -AVATAR_DROP }]}>
        <View style={styles.identityTop}>
          <Pressable
            accessibilityRole={onPickAvatar ? 'button' : undefined}
            accessibilityLabel={onPickAvatar ? 'Change your profile picture' : `${name}'s picture`}
            disabled={!onPickAvatar}
            onPress={onPickAvatar}
            style={styles.avatarHit}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.background },
              ]}
            >
              {profile.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  transition={200}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <AppText variant="title" weight="700" display tone="secondary">
                  {initialsFrom(name)}
                </AppText>
              )}
              {uploading === 'avatar' ? (
                <View style={[StyleSheet.absoluteFill, styles.uploadScrim]}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            {onPickAvatar ? (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={18} color={colors.accent} />
              </View>
            ) : null}
          </Pressable>
          {right}
        </View>

        <AppText variant="hero" weight="700" display numberOfLines={2} style={styles.name}>
          {name}
        </AppText>

        {onOpenFollowers || onOpenFollowing ? (
          <View style={styles.stats}>
            <Stat
              label={followerLabel(profile.followerCount)}
              hint={`See who follows ${name}`}
              onPress={onOpenFollowers}
            />
            <StatDot />
            <Stat
              label={followingLabel(profile.followingCount)}
              hint={`See who ${name} follows`}
              onPress={onOpenFollowing}
            />
            <StatDot />
            <AppText variant="caption" weight="600">
              {postLabel(profile.postCount)}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" weight="600" accessibilityRole="text">
            {profileStatLine(profile.followerCount, profile.followingCount, profile.postCount)}
          </AppText>
        )}

        {profile.bio ? (
          <AppText variant="body" tone="secondary" style={styles.bio}>
            {profile.bio}
          </AppText>
        ) : null}

        {profile.homeGym ? (
          <View style={styles.gymLine} accessibilityLabel={`Trains at ${profile.homeGym.name}`}>
            <Ionicons name="fitness-outline" size={14} color={colors.textSecondary} />
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.gymText}>
              Trains at {profile.homeGym.name}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** One tappable count in the stat line. Without a handler it is the same
 * text without the touch target, so the line reads identically either way. */
function Stat({ label, hint, onPress }: { label: string; hint: string; onPress?: () => void }) {
  if (!onPress) {
    return (
      <AppText variant="caption" weight="600">
        {label}
      </AppText>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <AppText variant="caption" weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

/** The separator between counts. A gap either side stands in for the spaces
 * around the dot in `profileStatLine`, so the line keeps its measure. */
function StatDot() {
  return (
    <AppText variant="caption" weight="600" tone="secondary" accessibilityElementsHidden>
      ·
    </AppText>
  );
}

/**
 * Back on the left; chats, notifications, then the same account picture as
 * Today on the right. Shared by the inline banner chrome and the sticky
 * header bar.
 */
export function ProfileHeaderChrome({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.chromeRow}>
      <GhostButton icon="chevron-back" label="Back" onPress={onBack} size={28} contrast />
      <View style={styles.menu}>
        <HeaderChatsButton />
        <HeaderNotifyButton />
        <HeaderAvatarButton />
      </View>
    </View>
  );
}

/** Icon-only control with no circular plate. `contrast` stamps a dark
 * offset behind a white glyph so a banner photo cannot swallow it. */
export function GhostButton({
  icon,
  label,
  onPress,
  size = 22,
  color = '#FFFFFF',
  contrast = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  contrast?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.75 }]}
    >
      {contrast ? (
        <Ionicons name={icon} size={size} color="rgba(0,0,0,0.7)" style={styles.iconOffset} />
      ) : null}
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** @deprecated Same as GhostButton — kept so older imports keep compiling. */
export const CircleButton = GhostButton;

function initialsFrom(name: string): string {
  const parts = name.replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  chrome: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  chromeRow: {
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOffset: {
    position: 'absolute',
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  bannerHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  onPhoto: { color: '#FFFFFF' },
  uploadScrim: {
    backgroundColor: 'rgba(6,9,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarHit: {
    width: AVATAR,
    height: AVATAR,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.lg,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: spacing.xs,
    fontSize: 32,
    lineHeight: 38,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  gymLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  gymText: {
    flexShrink: 1,
  },
  bio: {
    marginTop: 2,
  },
});
