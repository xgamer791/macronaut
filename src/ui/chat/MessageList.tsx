import { Image } from 'expo-image';
import React, { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { groupMessages, messageTime, type ChatTurn } from '@/domain/chatThread';
import type { ChatIdentity, ChatMessage } from '@/repositories/chatRepo';
import { AppText, ChatAvatar, ChatVideo } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

/** Avatar beside a message group. Small enough to read as a signature on the
 * conversation rather than a second column. */
const ROW_AVATAR = 28;
/** Gutter above a new turn, so runs are legible without a divider. */
const GROUP_GAP = spacing.md;
/** Bubble corners, and the flattened one on the tail of a run. */
const BUBBLE_RADIUS = 20;
const TAIL_RADIUS = 7;
/** A media bubble is capped so a tall photo cannot take the whole thread. */
const MEDIA_MAX_HEIGHT = 320;
const MEDIA_MAX_WIDTH = 340;
const MEDIA_DEFAULT_RATIO = 4 / 3;

/** A message that may carry its sender. A direct message leaves that to the
 * one peer; a group message names who wrote it. */
export type ListedMessage = ChatMessage & { sender?: ChatIdentity };

export interface MessageListProps<M extends ListedMessage> {
  /** Ascending by time, as the thread queries return them. */
  messages: M[];
  me: ChatIdentity | null;
  /** The other person in a direct chat. A message with its own sender wins. */
  peer?: ChatIdentity;
  /** Name each sender over the first bubble of their run — a group has more
   * than one "them", so a bubble alone does not say who is talking. */
  showSenderNames?: boolean;
  /** Offered on every bubble when given, for a delete sheet or the like. */
  onLongPressMessage?: (message: M) => void;
  /** Drawn centred when there is nothing yet. */
  empty: React.ReactNode;
}

/** The scrolling thread: runs of bubbles by one person, day headings between
 * them, the avatar and time under the last of a run. Shared by direct and
 * group chats — the only difference is who a bubble is from. */
export function MessageList<M extends ListedMessage>({
  messages,
  me,
  peer,
  showSenderNames = false,
  onLongPressMessage,
  empty,
}: MessageListProps<M>) {
  const scroll = useRef<ScrollView>(null);
  const turns = useMemo(() => groupMessages(messages), [messages]);

  return (
    <ScrollView
      ref={scroll}
      style={styles.messages}
      contentContainerStyle={[styles.messageContent, !turns.length && styles.emptyMessages]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
    >
      {turns.length ? (
        turns.map((turn) => (
          <React.Fragment key={turn.message.id}>
            {turn.daySeparator ? <DaySeparator label={turn.daySeparator} /> : null}
            <MessageRow
              turn={turn}
              peer={peer}
              me={me}
              showSenderName={showSenderNames}
              onLongPress={onLongPressMessage}
            />
          </React.Fragment>
        ))
      ) : (
        <View style={styles.hello}>{empty}</View>
      )}
    </ScrollView>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.daySeparator}>
      <AppText variant="micro" weight="600" tone="muted" style={styles.dayLabel}>
        {label}
      </AppText>
    </View>
  );
}

/** One message: avatar gutter, bubble, and the time under the last of a run. */
function MessageRow<M extends ListedMessage>({
  turn,
  peer,
  me,
  showSenderName,
  onLongPress,
}: {
  turn: ChatTurn<M>;
  peer?: ChatIdentity;
  me: ChatIdentity | null;
  showSenderName: boolean;
  onLongPress?: (message: M) => void;
}) {
  const { message, first, last } = turn;
  const mine = message.isMine;
  const person = mine ? me : (message.sender ?? peer ?? null);
  const named = showSenderName && !mine && first && message.sender ? message.sender : null;

  return (
    <View style={first ? styles.turnFirst : styles.turn}>
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={styles.gutter}>
          {last && person ? <ChatAvatar person={person} size={ROW_AVATAR} /> : null}
        </View>
        <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : null]}>
          {named ? (
            <AppText variant="micro" tone="muted" numberOfLines={1} style={styles.senderName}>
              {named.displayName}
            </AppText>
          ) : null}
          {onLongPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={message.body || 'Message'}
              accessibilityHint="Long press for options"
              onLongPress={() => onLongPress(message)}
              delayLongPress={350}
            >
              <MessageBubble message={message} last={last} />
            </Pressable>
          ) : (
            <MessageBubble message={message} last={last} />
          )}
        </View>
      </View>
      {/* Outside the avatar row, so the picture sits on the bubble's baseline
          rather than on the timestamp's. */}
      {last ? (
        <AppText
          variant="micro"
          tone="muted"
          style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}
        >
          {messageTime(message.createdAt)}
        </AppText>
      ) : null}
    </View>
  );
}

function MessageBubble({ message, last }: { message: ChatMessage; last: boolean }) {
  const { colors } = useTheme();
  const mine = message.isMine;
  const tail = last ? TAIL_RADIUS : BUBBLE_RADIUS;
  const bubble = [
    styles.bubble,
    {
      backgroundColor: mine ? colors.accent : colors.surfaceRaised,
      borderBottomRightRadius: mine ? tail : BUBBLE_RADIUS,
      borderBottomLeftRadius: mine ? BUBBLE_RADIUS : tail,
    },
  ];

  if (message.media) {
    return (
      <View style={[...bubble, styles.mediaBubble]}>
        <MessageMedia media={message.media} />
        {message.body ? (
          <View style={styles.mediaCaption}>
            <AppText style={{ color: mine ? colors.onAccent : colors.textPrimary }}>
              {message.body}
            </AppText>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[...bubble, styles.textBubble]}>
      <AppText style={{ color: mine ? colors.onAccent : colors.textPrimary }}>
        {message.body}
      </AppText>
    </View>
  );
}

/** The picture or clip inside a bubble, shaped by the sender's own pixels so
 * the thread does not reflow when the file lands. */
function MessageMedia({ media }: { media: NonNullable<ChatMessage['media']> }) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const boxWidth = Math.min(
    Math.round((screenWidth - spacing.lg * 2 - ROW_AVATAR - spacing.sm) * 0.86),
    MEDIA_MAX_WIDTH,
  );
  const ratio =
    media.width && media.height && media.height > 0
      ? media.width / media.height
      : MEDIA_DEFAULT_RATIO;
  const height = Math.min(Math.round(boxWidth / Math.max(ratio, 0.6)), MEDIA_MAX_HEIGHT);

  return (
    <View style={[styles.media, { width: boxWidth, height, backgroundColor: colors.track }]}>
      {media.kind === 'video' ? (
        <ChatVideo uri={media.url} accessibilityLabel="Video in this conversation" />
      ) : (
        <Image
          source={{ uri: media.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={140}
          accessibilityLabel="Photo in this conversation"
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  messages: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyMessages: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hello: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  daySeparator: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dayLabel: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  turn: {
    marginTop: 2,
  },
  turnFirst: {
    marginTop: GROUP_GAP,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  rowMine: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
  },
  // Always present, so a continuation bubble lines up under the one above it.
  gutter: {
    width: ROW_AVATAR,
    height: ROW_AVATAR,
  },
  bubbleWrap: {
    flexShrink: 1,
    maxWidth: '84%',
    alignItems: 'flex-start',
  },
  bubbleWrapMine: {
    alignItems: 'flex-end',
  },
  senderName: {
    paddingLeft: 4,
    paddingBottom: 3,
  },
  bubble: {
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
    overflow: 'hidden',
  },
  textBubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  mediaBubble: {
    padding: 3,
  },
  media: {
    borderRadius: BUBBLE_RADIUS - 5,
    overflow: 'hidden',
  },
  mediaCaption: {
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 4,
  },
  time: {
    paddingTop: 3,
  },
  // Indented past the avatar gutter so it starts under the bubble.
  timeTheirs: {
    alignSelf: 'flex-start',
    paddingLeft: ROW_AVATAR + spacing.sm + 4,
  },
  timeMine: {
    alignSelf: 'flex-end',
    paddingRight: ROW_AVATAR + spacing.sm + 4,
  },
});
