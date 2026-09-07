import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ProfilePost } from '@/repositories/profileRepo';
import { relativeTime } from '@/utils/relativeTime';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { EmptyState } from './EmptyState';

export interface ProfilePostListProps {
  posts: ProfilePost[];
  /** Owner only. Given a post, open the edit / delete choice for it. */
  onManage?: (post: ProfilePost) => void;
  /** Shown when there is nothing to list. */
  emptyTitle: string;
  emptyBody: string;
}

/** The posts on a profile page, newest first. Read-only unless `onManage`. */
export function ProfilePostList({ posts, onManage, emptyTitle, emptyBody }: ProfilePostListProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const imageHeight = Math.round((width - spacing.lg * 2) * 0.62);

  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {posts.map((post) => (
        <View
          key={post.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.head}>
            <AppText variant="micro" tone="muted" weight="600">
              {relativeTime(post.createdAt)}
              {post.updatedAt !== post.createdAt ? ' · edited' : ''}
            </AppText>
            {onManage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Post options"
                onPress={() => onManage(post)}
                hitSlop={8}
                style={styles.manage}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {post.body ? <AppText variant="body">{post.body}</AppText> : null}

          {post.imageUrl ? (
            <Image
              source={{ uri: post.imageUrl }}
              style={[styles.image, { height: imageHeight, backgroundColor: colors.track }]}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  manage: {
    width: touchTarget / 2,
    height: touchTarget / 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
});
