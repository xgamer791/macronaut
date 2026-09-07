import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  EmptyState,
  ProfileHeader,
  ProfilePostList,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useAuth } from '@/state/AuthProvider';
import { usePublicProfile, useSetProfileFollow } from '@/state/queries';
import { goBackOrHome } from '@/utils/navigation';
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
      <PublicProfile />
    </ThemeProvider>
  );
}

function PublicProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const result = usePublicProfile(handle ?? '');
  const setFollow = useSetProfileFollow();

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
          onAction={() => goBackOrHome(router)}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop={false} scroll>
      <ProfileHeader profile={found.profile} onBack={() => goBackOrHome(router)} />
      <View style={styles.body}>
        {found.profile.isOwner ? (
          <AppText variant="caption" tone="muted">
            This is how your page looks to other people.
          </AppText>
        ) : (
          <Button
            title={found.profile.isFollowing ? 'Following' : 'Follow'}
            variant={found.profile.isFollowing ? 'secondary' : 'primary'}
            loading={setFollow.isPending}
            onPress={() => {
              if (!signedIn) {
                router.push('/login');
                return;
              }
              void setFollow.mutateAsync({
                handle: found.profile.handle,
                follow: !found.profile.isFollowing,
              });
            }}
          />
        )}
        <SectionHeader title="Posts" />
        <ProfilePostList
          posts={found.posts}
          emptyTitle="No posts yet"
          emptyBody={`${found.profile.displayName ?? `@${found.profile.handle}`} has not posted anything.`}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
});
