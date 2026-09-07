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
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendsFeedPost } from '@/repositories/profileRepo';
import { useFriendsFeed } from '@/state/queries';
import { AppText, EmptyState, ErrorState, GlassHeaderBar } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { relativeTime } from '@/utils/relativeTime';

const MAX_FEED_WIDTH = 720;

/** Latest posts from mutual friends, fetched ten at a time. */
export default function FriendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const feed = useFriendsFeed();
  const posts = feed.data?.pages.flatMap((page) => page.page) ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <FriendsFeedCard
            post={item}
            onOpenProfile={
              item.author.canOpenProfile ? () => router.push(`/u/${item.author.handle}`) : undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 88 },
        ]}
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
            progressViewOffset={insets.top + 64}
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
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceRaised }]}>
                <Ionicons name="people" size={30} color={colors.accent} />
              </View>
              <EmptyState
                title="Your friends feed starts here"
                body="Add friends to see their latest Macronaut posts in this feed."
                actionTitle="Find friends"
                onAction={() => router.push('/new-chat')}
              />
            </View>
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
              <View style={[styles.endLine, { backgroundColor: colors.border }]} />
              <AppText variant="caption" tone="muted">
                You’re all caught up
              </AppText>
              <View style={[styles.endLine, { backgroundColor: colors.border }]} />
            </View>
          ) : null
        }
      />

      <GlassHeaderBar inset={spacing.lg}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText variant="micro" tone="accent" weight="700" style={styles.eyebrow}>
              YOUR CIRCLE
            </AppText>
            <AppText variant="title" display weight="600">
              Friends
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find friends"
            accessibilityHint="Search for people on Macronaut"
            onPress={() => router.push('/new-chat')}
            style={({ pressed }) => [
              styles.findFriends,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </GlassHeaderBar>
    </View>
  );
}

function FriendsFeedCard({
  post,
  onOpenProfile,
}: {
  post: FriendsFeedPost;
  onOpenProfile?: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const imageHeight = Math.round(
    Math.min(Math.max((Math.min(width, MAX_FEED_WIDTH) - spacing.lg * 2) * 0.68, 220), 470),
  );
  const name = post.author.displayName?.trim() || `@${post.author.handle}`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole={onOpenProfile ? 'button' : undefined}
        accessibilityLabel={onOpenProfile ? `Open ${name}'s profile` : undefined}
        disabled={!onOpenProfile}
        onPress={onOpenProfile}
        style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
      >
        <View style={[styles.avatarRing, { borderColor: colors.accent }]}>
          {post.author.avatarUrl ? (
            <Image
              source={{ uri: post.author.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              transition={160}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.surfaceRaised }]}>
              <AppText variant="caption" tone="accent" weight="700">
                {initials(name)}
              </AppText>
            </View>
          )}
        </View>

        <View style={styles.authorCopy}>
          <AppText variant="body" weight="700" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            @{post.author.handle} · {relativeTime(post.createdAt)}
            {post.updatedAt !== post.createdAt ? ' · edited' : ''}
          </AppText>
        </View>
        {onOpenProfile ? (
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        ) : null}
      </Pressable>

      {post.body ? (
        <AppText variant="body" style={styles.body}>
          {post.body}
        </AppText>
      ) : null}

      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={[styles.postImage, { height: imageHeight, backgroundColor: colors.track }]}
          contentFit="cover"
          transition={220}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {onOpenProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name}'s profile`}
          onPress={onOpenProfile}
          style={({ pressed }) => [
            styles.profileAction,
            { borderTopColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="person-outline" size={18} color={colors.accent} />
          <AppText variant="caption" tone="accent" weight="700">
            View profile
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function FeedSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading friends feed">
      {[0, 1, 2].map((item) => (
        <View
          key={item}
          style={[
            styles.skeletonCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.skeletonHead}>
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.surfaceRaised }]} />
            <View style={styles.skeletonCopy}>
              <View style={[styles.skeletonName, { backgroundColor: colors.surfaceRaised }]} />
              <View style={[styles.skeletonMeta, { backgroundColor: colors.surfaceRaised }]} />
            </View>
          </View>
          <View style={[styles.skeletonBody, { backgroundColor: colors.surfaceRaised }]} />
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
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MAX_FEED_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCopy: {
    gap: 1,
  },
  eyebrow: {
    letterSpacing: 1.25,
  },
  findFriends: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  authorRow: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarFallback: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorCopy: {
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  postImage: {
    width: '100%',
  },
  profileAction: {
    minHeight: touchTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.65,
  },
  emptyWrap: {
    paddingTop: spacing.xxl * 2,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -spacing.sm,
  },
  footer: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  endLine: {
    width: 36,
    height: StyleSheet.hairlineWidth,
  },
  skeletonList: {
    gap: spacing.md,
  },
  skeletonCard: {
    minHeight: 190,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  skeletonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  skeletonCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonName: {
    height: 14,
    width: '48%',
    borderRadius: radius.full,
  },
  skeletonMeta: {
    height: 10,
    width: '70%',
    borderRadius: radius.full,
  },
  skeletonBody: {
    height: 86,
    borderRadius: radius.md,
  },
});
