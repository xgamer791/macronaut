import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MessageSquare, ThumbsUp } from 'lucide-react-native';
import { ShareFatIcon } from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import type { ProfilePost, ProfilePostComment } from '@/repositories/profileRepo';
import { useAuth } from '@/state/AuthProvider';
import {
  useAddProfilePostComment,
  useProfilePostThread,
  useRemoveProfilePostComment,
  useSetProfilePostLike,
} from '@/state/queries';
import { compactCount } from '@/utils/compactCount';
import { profilePostShareUrl } from '@/utils/publicLinks';
import { relativeTime } from '@/utils/relativeTime';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

/** One size for all three glyphs, Lucide and Phosphor alike. */
const POST_ACTION_GLYPH = 18;

export interface ProfilePostActionsProps {
  post: ProfilePost;
  ownerHandle: string;
  style?: StyleProp<ViewStyle>;
}

/** Like, comment and share controls shared by profile cards and feed posts. */
export function ProfilePostActions({ post, ownerHandle, style }: ProfilePostActionsProps) {
  const router = useRouter();
  const { signedIn } = useAuth();
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thread = useProfilePostThread(post.id, commentsOpen);
  const setLike = useSetProfilePostLike();
  const addComment = useAddProfilePostComment();
  const removeComment = useRemoveProfilePostComment();
  const liked = thread.data?.likedByMe ?? post.likedByMe;
  const likeCount = thread.data?.likeCount ?? post.likeCount;
  const commentCount = thread.data?.commentCount ?? post.commentCount;

  function needSignIn() {
    setCommentsOpen(false);
    router.push('/login');
  }

  async function like() {
    if (!signedIn) {
      needSignIn();
      return;
    }
    setError(null);
    void Haptics.selectionAsync();
    try {
      await setLike.mutateAsync({ id: post.id, liked: !liked });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that reaction.');
    }
  }

  async function sharePost() {
    const url = profilePostShareUrl(ownerHandle, post.id);
    const message = post.body.trim() ? `${post.body.trim()}\n${url}` : url;
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        await Share.share({ message, url });
        return;
      }
      const nav = typeof navigator === 'undefined' ? undefined : navigator;
      if (nav?.share) {
        await nav.share({ text: post.body.trim() || undefined, url });
        return;
      }
      if (!nav?.clipboard) throw new Error('no clipboard');
      await nav.clipboard.writeText(message);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setError(`Could not share automatically. The link is ${url}`);
    }
  }

  async function sendComment() {
    const body = draft.trim();
    if (!body) return;
    if (!signedIn) {
      needSignIn();
      return;
    }
    setError(null);
    try {
      await addComment.mutateAsync({ id: post.id, body });
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post that comment.');
    }
  }

  return (
    <>
      <View style={[styles.actions, { borderTopColor: colors.border }, style]}>
        <PostAction
          label={liked ? 'Unlike post' : 'Like post'}
          count={likeCount}
          active={liked}
          disabled={setLike.isPending}
          onPress={() => void like()}
        >
          <ThumbsUp
            size={POST_ACTION_GLYPH}
            strokeWidth={1.8}
            color={liked ? colors.accent : colors.textSecondary}
            fill={liked ? colors.accent : 'transparent'}
          />
        </PostAction>
        <PostAction
          label="Comment on post"
          count={commentCount}
          onPress={() => {
            void Haptics.selectionAsync();
            setCommentsOpen(true);
          }}
        >
          <MessageSquare size={POST_ACTION_GLYPH} strokeWidth={1.8} color={colors.textSecondary} />
        </PostAction>
        <PostAction label="Share post" onPress={() => void sharePost()}>
          <ShareFatIcon size={POST_ACTION_GLYPH} weight="regular" color={colors.textSecondary} />
          {shared ? (
            <AppText variant="micro" tone="accent" accessibilityLiveRegion="polite">
              Copied
            </AppText>
          ) : null}
        </PostAction>
      </View>

      {error ? (
        <AppText
          variant="micro"
          tone="danger"
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : null}

      <Sheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} title="Comments">
        {thread.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : thread.isError || thread.data === null ? (
          <AppText tone="danger">Comments could not be loaded.</AppText>
        ) : thread.data.comments.length === 0 ? (
          <AppText tone="secondary">Be the first to comment.</AppText>
        ) : (
          thread.data.comments.map((comment) => (
            <PostCommentRow
              key={comment.id}
              comment={comment}
              deleting={removeComment.isPending}
              onDelete={() => void removeComment.mutateAsync({ postId: post.id, id: comment.id })}
            />
          ))
        )}

        {signedIn ? (
          <View style={styles.composer}>
            <TextField
              placeholder="Write a comment"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void sendComment()}
              returnKeyType="send"
              maxLength={280}
              style={styles.field}
            />
            <Button
              compact
              title="Post"
              loading={addComment.isPending}
              disabled={!draft.trim()}
              onPress={() => void sendComment()}
            />
          </View>
        ) : (
          <Button title="Sign in to comment" onPress={needSignIn} />
        )}
      </Sheet>
    </>
  );
}

function PostAction({
  children,
  label,
  count,
  active,
  disabled,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.5 : pressed ? 0.65 : 1 }]}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <AppText variant="caption" weight="600" tone={active ? 'accent' : 'secondary'}>
          {compactCount(count)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function PostCommentRow({
  comment,
  deleting,
  onDelete,
}: {
  comment: ProfilePostComment;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.comment}>
      <View style={styles.commentCopy}>
        <AppText weight="600">{comment.authorName}</AppText>
        <AppText>{comment.body}</AppText>
        <AppText variant="micro" tone="muted">
          {relativeTime(comment.createdAt)}
        </AppText>
      </View>
      {comment.isMine ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete comment"
          disabled={deleting}
          hitSlop={8}
          onPress={onDelete}
          style={({ pressed }) => ({ opacity: deleting ? 0.4 : pressed ? 0.65 : 1 })}
        >
          <AppText variant="micro" tone="danger" weight="600">
            Delete
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    minHeight: touchTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Sized to its own glyph rather than a third of the card, so the three sit
  // together at the left edge. The minimums keep the tap target honest.
  action: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  error: {
    paddingTop: spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  commentCopy: {
    flex: 1,
    gap: 2,
  },
});
