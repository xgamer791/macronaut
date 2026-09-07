import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  EmptyState,
  GlassHeaderBar,
  ProfileHeader,
  ProfileHeaderChrome,
  ProfilePhotoBlock,
  ProfilePostList,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useAuth } from '@/state/AuthProvider';
import {
  useOpenChat,
  usePublicPhotos,
  usePublicProfile,
  useSetProfileFollow,
} from '@/state/queries';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

/**
 * Someone's public profile page. The only screen in the app that shows another
 * account's data, and it renders whatever the server was willing to hand over
 * — a private profile and a handle nobody owns both arrive as null, so this
 * page cannot be used to find out which.
 *
 * Read-only: no pick handlers are passed to `ProfileHeader`, so none of the
 * editing affordances render.
 */
export default function PublicProfileScreen() {
  return (
    <ThemeProvider initialMode="dark">
      <SlideScreen from="right">
        <PublicProfile />
      </SlideScreen>
    </ThemeProvider>
  );
}

function PublicProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const onBack = useSlideBack();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const result = usePublicProfile(handle ?? '');
  const photos = usePublicPhotos(handle ?? '');
  const setFollow = useSetProfileFollow();
  const openChat = useOpenChat();
  const [note, setNote] = useState<string | null>(null);

  if (result.isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const found = result.data;
  if (!found) {
    return (
      <Screen>
        <EmptyState
          title="Profile not available"
          body={`Nobody at @${handle ?? ''} has a public profile. The link may be wrong, or they may have made their page private.`}
          actionTitle="Back"
          onAction={onBack}
        />
      </Screen>
    );
  }

  const profile = found.profile;

  function openConnections(tab: 'followers' | 'following') {
    void Haptics.selectionAsync();
    router.push({ pathname: '/connections', params: { handle: profile.handle, tab } });
  }

  /**
   * Open the conversation with this person. Messaging waits on a mutual
   * follow — the server refuses anything less — so when the follow only goes
   * one way the button says which half is missing rather than failing.
   */
  async function message() {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    const name = profile.displayName?.trim() || `@${profile.handle}`;
    if (!(profile.isFollowing && profile.isFollowedBy)) {
      setNote(
        profile.isFollowing
          ? `You can message ${name} once they follow you back.`
          : `Follow ${name} to message them. Messages open once you follow each other.`,
      );
      return;
    }
    setNote(null);
    try {
      const chat = await openChat.mutateAsync({ handle: profile.handle });
      router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not start that chat.');
    }
  }

  return (
    <Screen
      padded={false}
      safeTop={false}
      scroll
      stickyHeader={
        <GlassHeaderBar inset={spacing.md}>
          <ProfileHeaderChrome onBack={onBack} />
        </GlassHeaderBar>
      }
    >
      <ProfileHeader
        profile={found.profile}
        onBack={onBack}
        showChrome={false}
        onOpenFollowers={() => openConnections('followers')}
        onOpenFollowing={() => openConnections('following')}
      />
      <View style={styles.actions}>
        <PublicAction
          icon="images-outline"
          label="Photos"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push({ pathname: '/photos', params: { handle: found.profile.handle } });
          }}
        />
        <PublicAction
          icon="people-outline"
          label="Groups"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push({ pathname: '/groups', params: { handle: found.profile.handle } });
          }}
        />
      </View>
      <View style={styles.body}>
        {found.profile.isOwner ? (
          <AppText variant="caption" tone="muted">
            This is how your page looks to other people.
          </AppText>
        ) : (
          <>
            {/* One line, split evenly: neither action outranks the other once
                you already follow, and the pair keeps the page's rhythm. */}
            <View style={styles.actionRow}>
              <Button
                style={styles.actionButton}
                title={found.profile.isFollowing ? 'Following' : 'Follow'}
                variant={found.profile.isFollowing ? 'secondary' : 'primary'}
                loading={setFollow.isPending}
                onPress={() => {
                  if (!signedIn) {
                    router.push('/login');
                    return;
                  }
                  setNote(null);
                  void setFollow.mutateAsync({
                    handle: found.profile.handle,
                    follow: !found.profile.isFollowing,
                  });
                }}
              />
              <Button
                style={styles.actionButton}
                title="Message"
                variant="secondary"
                loading={openChat.isPending}
                onPress={() => void message()}
              />
            </View>
            {note ? (
              <AppText variant="caption" tone="muted">
                {note}
              </AppText>
            ) : null}
          </>
        )}
        <ProfilePhotoBlock
          photos={photos.data?.photos ?? []}
          loading={photos.isLoading}
          canSeePrivate={photos.data?.isOwner === true}
          onOpenPhoto={(photo) =>
            router.push({
              pathname: '/photos',
              params: { handle: found.profile.handle, photo: photo.id },
            })
          }
          onSeeAll={() =>
            router.push({ pathname: '/photos', params: { handle: found.profile.handle } })
          }
        />
        <SectionHeader title="Posts" />
        <ProfilePostList
          posts={found.posts}
          ownerHandle={found.profile.handle}
          emptyTitle="No posts yet"
          emptyBody={`${found.profile.displayName ?? `@${found.profile.handle}`} has not posted anything.`}
        />
      </View>
    </Screen>
  );
}

function PublicAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={24} color={colors.textPrimary} />
      </View>
      <AppText variant="micro" weight="600" align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexBasis: 0,
  },
  action: {
    width: 68,
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
});
