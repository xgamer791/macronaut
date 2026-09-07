import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendsFeedPost } from '@/repositories/profileRepo';
import { useFriendsFeed } from '@/state/queries';
import { AppText, Button, ErrorState, GlassHeaderBar, Screen, ScreenHeader } from '@/ui/components';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { relativeTime } from '@/utils/relativeTime';

const MAX_FEED_WIDTH = 680;

/** Latest posts from mutual friends, fetched ten at a time. */
export default function FriendsRoute() {
  return (
    <SlideScreen from="left">
      <FriendsScreen />
    </SlideScreen>
  );
}

function FriendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const feed = useFriendsFeed();
  const posts = feed.data?.pages.flatMap((page) => page.page) ?? [];
  const findFriends = () => router.push('/new-chat');

  return (
    <Screen
      padded={false}
      scroll={false}
      safeTop={false}
      collapseHeader={false}
      stickyHeader={
        <GlassHeaderBar inset={spacing.lg}>
          <ScreenHeader
            title="Friends"
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find friends"
                accessibilityHint="Search for people on Macronaut"
                onPress={findFriends}
                hitSlop={8}
                style={({ pressed }) => [styles.findFriends, pressed && styles.pressed]}
              >
                <Ionicons name="person-add-outline" size={24} color={colors.accent} />
              </Pressable>
            }
          />
        </GlassHeaderBar>
      }
    >
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <FriendsFeedPostView
            post={item}
            onOpenProfile={
              item.author.canOpenProfile ? () => router.push(`/u/${item.author.handle}`) : undefined
            }
          />
        )}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
          posts.length === 0 && styles.emptyContent,
        ]}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.45}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => void feed.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          feed.isPending ? (
            <FeedSkeleton />
          ) : feed.isError ? (
            <ErrorState
              message="Your friends feed could not be loaded."
              onRetry={() => void feed.refetch()}
            />
          ) : (
            <FeedEmpty onFindFriends={findFriends} />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="caption" tone="muted">
                Loading more posts…
              </AppText>
            </View>
          ) : posts.length > 0 && !feed.hasNextPage ? (
            <View style={styles.footer}>
              <AppText variant="caption" tone="muted">
                No more posts
              </AppText>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function FriendsFeedPostView({
  post,
  onOpenProfile,
}: {
  post: FriendsFeedPost;
  onOpenProfile?: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const imageHeight = Math.min(Math.round(Math.min(width, MAX_FEED_WIDTH) * 0.72), 480);
  const name = post.author.displayName?.trim() || `@${post.author.handle}`;
  const timestamp = `${relativeTime(post.createdAt)}${post.updatedAt !== post.createdAt ? ' edited' : ''}`;

  return (
    <View style={[styles.post, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole={onOpenProfile ? 'button' : undefined}
        accessibilityLabel={onOpenProfile ? `Open ${name}'s profile` : undefined}
        disabled={!onOpenProfile}
        onPress={onOpenProfile}
        style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
      >
        <View style={[styles.avatarFrame, { backgroundColor: colors.surfaceRaised }]}>
          {post.author.avatarUrl ? (
            <Image
              source={{ uri: post.author.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              transition={160}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <AppText variant="caption" tone="accent" weight="700">
              {initials(name)}
            </AppText>
          )}
        </View>

        <View style={styles.authorCopy}>
          <AppText weight="700" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            @{post.author.handle}
          </AppText>
        </View>

        <View style={styles.postMeta}>
          <AppText variant="micro" tone="muted" numberOfLines={1}>
            {timestamp}
          </AppText>
          {onOpenProfile ? (
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          ) : null}
        </View>
      </Pressable>

      {post.body ? (
        <AppText style={[styles.postBody, !post.imageUrl && styles.textOnlyBody]}>
          {post.body}
        </AppText>
      ) : null}

      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={[styles.postImage, { height: imageHeight, backgroundColor: colors.track }]}
          contentFit="cover"
          transition={220}
          accessibilityLabel={`${name}'s post image`}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

function FeedEmpty({ onFindFriends }: { onFindFriends: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="people-outline" size={38} color={colors.accent} />
      <View style={styles.emptyCopy}>
        <AppText variant="heading" weight="700" align="center">
          No friend posts yet
        </AppText>
        <AppText variant="caption" tone="secondary" align="center">
          Find people on Macronaut to start your feed.
        </AppText>
      </View>
      <Button compact title="Find friends" onPress={onFindFriends} />
    </View>
  );
}

function FeedSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading friends feed">
      {[0, 1].map((item) => (
        <View key={item} style={[styles.skeletonPost, { borderBottomColor: colors.border }]}>
          <View style={styles.skeletonHead}>
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.surfaceRaised }]} />
            <View style={styles.skeletonCopy}>
              <View style={[styles.skeletonName, { backgroundColor: colors.surfaceRaised }]} />
              <View style={[styles.skeletonMeta, { backgroundColor: colors.surfaceRaised }]} />
            </View>
          </View>
          <View style={styles.skeletonText}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.surfaceRaised }]} />
            <View
              style={[
                styles.skeletonLine,
                styles.skeletonLineShort,
                { backgroundColor: colors.surfaceRaised },
              ]}
            />
          </View>
          <View style={[styles.skeletonMedia, { backgroundColor: colors.surfaceRaised }]} />
        </View>
      ))}
    </View>
  );
}

function initials(name: string): string {
  return name
    .replace(/^@/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MAX_FEED_WIDTH,
    alignSelf: 'center',
  },
  emptyContent: {
    flexGrow: 1,
  },
  findFriends: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  post: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  authorRow: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarFrame: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  authorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  postMeta: {
    maxWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  postBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    fontSize: 16,
    lineHeight: 23,
  },
  textOnlyBody: {
    paddingBottom: spacing.xl,
  },
  postImage: {
    width: '100%',
  },
  pressed: {
    opacity: 0.65,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  emptyCopy: {
    maxWidth: 300,
    gap: spacing.xs,
  },
  footer: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  skeletonPost: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeletonHead: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
  },
  skeletonCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonName: {
    height: 13,
    width: '42%',
    borderRadius: radius.full,
  },
  skeletonMeta: {
    height: 9,
    width: '28%',
    borderRadius: radius.full,
  },
  skeletonText: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  skeletonLine: {
    height: 11,
    width: '82%',
    borderRadius: radius.full,
  },
  skeletonLineShort: {
    width: '54%',
  },
  skeletonMedia: {
    width: '100%',
    height: 300,
  },
});
