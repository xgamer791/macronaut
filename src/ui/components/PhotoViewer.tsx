import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PhotoComment, PhotoThread, ProfilePhoto } from '@/repositories/photoRepo';
import { compactCount } from '@/utils/compactCount';
import { relativeTime, shortDate } from '@/utils/relativeTime';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './TextField';
import { usePushWhileOpen } from '@/ui/motion/SlidePush';

const LOVE_RED = '#F0284F';
const ON_PHOTO = '#FFFFFF';
/** Keep the three actions visually grouped while preserving 44px tap targets. */
const ACTION_GAP = spacing.sm;

export interface PhotoViewerProps {
  photo: ProfilePhoto | null;
  thread?: PhotoThread | null;
  canEdit: boolean;
  signedIn: boolean;
  onClose: () => void;
  onLike: (liked: boolean) => void;
  onComment: (body: string) => Promise<void>;
  onDeleteComment: (id: string) => void;
  onShare: () => void;
  onTogglePublic?: () => void;
  onDelete?: () => void;
  onNeedSignIn: () => void;
}

/**
 * Full-screen photo viewer. The photo sits in the vertical middle of the
 * screen; name, date and like / comment / share sit on the black canvas as
 * overlays, not inside a bottom card.
 */
export function PhotoViewer({
  photo,
  thread,
  canEdit,
  signedIn,
  onClose,
  onLike,
  onComment,
  onDeleteComment,
  onShare,
  onTogglePublic,
  onDelete,
  onNeedSignIn,
}: PhotoViewerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const ownerName = thread?.ownerName ?? 'Photo';
  const likeCount = thread?.likeCount ?? 0;
  const liked = thread?.likedByMe ?? false;
  const comments = thread?.comments ?? [];

  async function send() {
    const body = draft.trim();
    if (!body) return;
    if (!signedIn) {
      onNeedSignIn();
      return;
    }
    setSending(true);
    try {
      await onComment(body);
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  function tapLike() {
    if (!signedIn) {
      onNeedSignIn();
      return;
    }
    void Haptics.selectionAsync();
    onLike(!liked);
  }

  function tapComment() {
    void Haptics.selectionAsync();
    setCommentsOpen(true);
    setMenuOpen(false);
  }

  function requestClose() {
    setCommentsOpen(false);
    setMenuOpen(false);
    setDraft('');
    onClose();
  }

  // A full-screen viewer, so the page it opened over travels a full screen.
  const { height: windowHeight } = useWindowDimensions();
  usePushWhileOpen(Boolean(photo), { y: -windowHeight });

  if (!photo) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={requestClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.stage, commentsOpen && styles.stageWithComments]}>
          <View style={styles.photoSlot} pointerEvents="none">
            {photo.imageUrl ? (
              <Image
                source={{ uri: photo.imageUrl }}
                style={styles.photo}
                contentFit="contain"
                contentPosition="center"
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>

          <View
            style={[styles.top, { paddingTop: insets.top + spacing.sm }]}
            pointerEvents="box-none"
          >
            <View style={styles.identity}>
              <AppText variant="heading" weight="700" style={styles.onPhoto}>
                {ownerName}
              </AppText>
              <View style={styles.meta}>
                <AppText variant="caption" style={styles.onPhotoMuted}>
                  {shortDate(photo.createdAt)}
                </AppText>
                <AppText variant="caption" style={styles.onPhotoMuted}>
                  {' · '}
                </AppText>
                <Ionicons
                  name={photo.isPublic ? 'globe-outline' : 'lock-closed-outline'}
                  size={12}
                  color="rgba(255,255,255,0.78)"
                />
              </View>
            </View>
            <View style={styles.topActions}>
              {canEdit ? (
                <IconHit
                  label="Photo options"
                  icon="ellipsis-horizontal"
                  onPress={() => {
                    setMenuOpen((open) => !open);
                    setCommentsOpen(false);
                  }}
                />
              ) : null}
              <IconHit label="Close photo" icon="close" onPress={requestClose} />
            </View>
          </View>

          <View
            style={[
              styles.bottom,
              { paddingBottom: commentsOpen ? spacing.sm : insets.bottom + spacing.md },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.actions}>
              <Engage
                count={likeCount}
                label={liked ? 'Unlike photo' : 'Like photo'}
                onPress={tapLike}
              >
                <Feather name="thumbs-up" size={23} color={liked ? colors.accent : ON_PHOTO} />
              </Engage>
              <Engage count={comments.length} label="Comment on photo" onPress={tapComment}>
                <Ionicons name="chatbubble-outline" size={22} color={ON_PHOTO} />
              </Engage>
              <Engage label="Share photo" onPress={onShare}>
                <Ionicons name="arrow-redo-outline" size={22} color={ON_PHOTO} />
              </Engage>
            </View>
            {likeCount > 0 ? (
              <View style={styles.badges} accessibilityLabel={`${compactCount(likeCount)} likes`}>
                <View style={[styles.badge, { backgroundColor: colors.accent, zIndex: 2 }]}>
                  <MaterialCommunityIcons name="thumb-up" size={10} color={ON_PHOTO} />
                </View>
                {likeCount > 1 ? (
                  <View style={[styles.badge, styles.badgeOverlap, { backgroundColor: LOVE_RED }]}>
                    <Ionicons name="heart" size={10} color={ON_PHOTO} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {menuOpen && canEdit ? (
          <View
            style={[
              styles.panel,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photo.isPublic ? 'Make photo private' : 'Make photo public'}
              onPress={() => {
                onTogglePublic?.();
                setMenuOpen(false);
              }}
              style={styles.menuRow}
            >
              <AppText>
                {photo.isPublic ? 'Only you can see this' : 'Visible on your public wall'}
              </AppText>
            </Pressable>
            <Button
              title="Delete photo"
              variant="danger"
              onPress={() => {
                setMenuOpen(false);
                onDelete?.();
              }}
            />
          </View>
        ) : null}

        {commentsOpen ? (
          <View
            style={[
              styles.panel,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.sm },
            ]}
          >
            <View style={styles.commentHead}>
              <AppText variant="heading" weight="600">
                Comments
              </AppText>
              <IconHit
                label="Close comments"
                icon="close"
                onPress={() => setCommentsOpen(false)}
                color={colors.textPrimary}
              />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.commentList}
              contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}
            >
              {comments.length === 0 ? (
                <AppText tone="secondary">Be the first to comment.</AppText>
              ) : (
                comments.map((row) => (
                  <CommentRow
                    key={row.id}
                    comment={row}
                    canDelete={row.isMine || canEdit}
                    onDelete={() => onDeleteComment(row.id)}
                  />
                ))
              )}
            </ScrollView>
            <View style={styles.composer}>
              <TextField
                placeholder={signedIn ? 'Write a comment' : 'Sign in to comment'}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => void send()}
                returnKeyType="send"
                style={{ flex: 1 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Post comment"
                onPress={() => void send()}
                disabled={sending || !draft.trim()}
                style={[
                  styles.send,
                  { backgroundColor: colors.textPrimary, opacity: draft.trim() ? 1 : 0.4 },
                ]}
              >
                <Ionicons name="arrow-up" size={18} color={colors.background} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Engage({
  children,
  count,
  label,
  onPress,
}: {
  children: React.ReactNode;
  count?: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={styles.engage}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <AppText variant="body" weight="600" style={styles.onPhoto}>
          {compactCount(count)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function IconHit({
  icon,
  label,
  onPress,
  color = ON_PHOTO,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.iconHit}
    >
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: PhotoComment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.commentRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="600">{comment.authorName}</AppText>
        <AppText>{comment.body}</AppText>
        <AppText variant="micro" tone="muted">
          {relativeTime(comment.createdAt)}
        </AppText>
      </View>
      {canDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete comment"
          onPress={onDelete}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.45)" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
  },
  stageWithComments: {
    flex: 1,
    minHeight: 0,
  },
  photoSlot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  identity: {
    flex: 1,
    paddingRight: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTION_GAP,
  },
  engage: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlap: {
    marginLeft: -6,
  },
  onPhoto: {
    color: ON_PHOTO,
  },
  onPhotoMuted: {
    color: 'rgba(255,255,255,0.78)',
  },
  iconHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
    maxHeight: '46%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#262C34',
  },
  menuRow: {
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentList: {
    flexGrow: 0,
    maxHeight: 220,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  send: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
