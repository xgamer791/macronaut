import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupMessages, messageTime, type ChatTurn } from '@/domain/chatThread';
import type { ChatMessage, ChatPerson, ChatThread } from '@/repositories/chatRepo';
import { pickAttachment, takePhotoAttachment } from '@/services/media/pickAttachment';
import type { PickedAttachment } from '@/services/media/pickedAttachment';
import { useAuth } from '@/state/AuthProvider';
import {
  useChatThread,
  useMarkChatRead,
  useSendChatMessage,
  useSetProfileFollow,
} from '@/state/queries';
import { AppText, Button, ChatAvatar, ChatVideo, EmptyState } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';
import { useComposerKeyboardGap } from '@/ui/motion/useComposerKeyboardGap';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';

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
const ATTACHMENT_MENU_HEIGHT = 82;
type IconName = keyof typeof Ionicons.glyphMap;

function dictatedMessage(existing: string, transcript: string): string {
  return [existing.trimEnd(), transcript.trim()].filter(Boolean).join(' ').slice(0, 2000);
}

function dictationErrorMessage(error: ExpoSpeechRecognitionErrorCode): string | null {
  if (error === 'aborted') return null;
  if (error === 'not-allowed') return 'Allow microphone access to use speech to text.';
  if (error === 'no-speech' || error === 'speech-timeout') {
    return "I didn't hear anything. Tap the microphone and try again.";
  }
  if (error === 'network') return 'Speech recognition needs a network connection.';
  if (error === 'language-not-supported')
    return 'Speech recognition is unavailable in this language.';
  return 'Speech recognition is unavailable right now.';
}

export default function ChatScreen() {
  return (
    <SlideScreen from="left">
      <Conversation />
    </SlideScreen>
  );
}

function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  const router = useRouter();
  const onBack = useSlideBack();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const thread = useChatThread(chatId);
  const send = useSendChatMessage();
  const setFriend = useSetProfileFollow();
  const { mutate: markRead } = useMarkChatRead();
  const lastMarkedRead = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const marker = thread.data?.unreadCount ? `${chatId}:${thread.data.updatedAt}` : null;
    if (!marker || lastMarkedRead.current === marker) return;
    lastMarkedRead.current = marker;
    markRead(chatId);
  }, [chatId, markRead, thread.data?.unreadCount, thread.data?.updatedAt]);

  async function chooseAttachment(source: 'library' | 'camera') {
    setError(null);
    try {
      const picked = source === 'camera' ? await takePhotoAttachment() : await pickAttachment();
      if (picked) setAttachment(picked);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : source === 'camera'
            ? 'Could not open your camera.'
            : 'Could not open your library.',
      );
    }
  }

  async function openShareProvider(name: string, url: string) {
    setError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setError(`Could not open ${name}.`);
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if ((!body && !attachment) || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync({ id: chatId, body, attachment: attachment ?? undefined });
      setDraft('');
      setAttachment(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that message.');
    }
  }

  if (!signedIn) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState
          title="Sign in to chat"
          body="Your conversations are saved securely with your Macronaut account."
          actionTitle="Sign in"
          onAction={() => router.replace('/login')}
        />
      </View>
    );
  }

  if (thread.isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!thread.data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState
          title="Chat not available"
          body="This conversation may have been removed."
          actionTitle="Back to chats"
          onAction={() => router.replace('/chats')}
        />
      </View>
    );
  }

  return (
    <ConversationView
      data={thread.data}
      draft={draft}
      onDraft={setDraft}
      attachment={attachment}
      onAttach={() => void chooseAttachment('library')}
      onTakePhoto={() => void chooseAttachment('camera')}
      onOpenGiphy={() => void openShareProvider('GIPHY', 'https://giphy.com/search')}
      onOpenMaps={() => void openShareProvider('Google Maps', 'https://maps.google.com')}
      onRemoveAttachment={() => setAttachment(null)}
      onSend={() => void sendMessage()}
      sending={send.isPending}
      error={error}
      onBack={onBack}
      onOpenProfile={(handle) => router.push(`/u/${handle}`)}
      addingFriend={setFriend.isPending}
      onAddFriend={async () => {
        setError(null);
        try {
          await setFriend.mutateAsync({ userId: thread.data!.peer.id, follow: true });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not update that friend request.');
        }
      }}
    />
  );
}

export interface ConversationViewProps {
  data: ChatThread;
  draft: string;
  onDraft: (value: string) => void;
  attachment: PickedAttachment | null;
  onAttach: () => void;
  onTakePhoto: () => void;
  onOpenGiphy: () => void;
  onOpenMaps: () => void;
  onRemoveAttachment: () => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
  onBack: () => void;
  onOpenProfile: (handle: string) => void;
  addingFriend: boolean;
  onAddFriend: () => void;
}

/** The conversation itself, with no data loading of its own — so the layout
 * can be opened against fixtures as well as against a live thread. */
export function ConversationView({
  data,
  draft,
  onDraft,
  attachment,
  onAttach,
  onTakePhoto,
  onOpenGiphy,
  onOpenMaps,
  onRemoveAttachment,
  onSend,
  sending,
  error,
  onBack,
  onOpenProfile,
  addingFriend,
  onAddFriend,
}: ConversationViewProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const {
    wrapRef: composerWrapRef,
    paddingBottom: composerPad,
    shift: composerShift,
    onFocus: onComposerFocus,
    onBlur: onComposerBlur,
  } = useComposerKeyboardGap(Math.max(insets.bottom, spacing.sm));
  const [menuProgress] = useState(() => new Animated.Value(0));
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [startingDictation, setStartingDictation] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const dictationBase = useRef('');
  const turns = useMemo(() => groupMessages(data.messages), [data.messages]);
  const canSend = Boolean(draft.trim() || attachment) && !sending;

  useSpeechRecognitionEvent('start', () => {
    setStartingDictation(false);
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    setStartingDictation(false);
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onDraft(dictatedMessage(dictationBase.current, transcript));
  });
  useSpeechRecognitionEvent('error', (event) => {
    setStartingDictation(false);
    setListening(false);
    setDictationError(dictationErrorMessage(event.error));
  });

  useEffect(
    () => () => {
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  useEffect(() => {
    Animated.timing(menuProgress, {
      toValue: attachmentMenuOpen ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [attachmentMenuOpen, menuProgress]);

  const menuHeight = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ATTACHMENT_MENU_HEIGHT],
  });
  const menuOpacity = menuProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0, 1],
  });
  const plusRotation = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  async function toggleDictation() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (startingDictation) return;

    setDictationError(null);
    setStartingDictation(true);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setDictationError('Speech to text is not supported on this device or browser.');
        setStartingDictation(false);
        return;
      }

      if (Platform.OS !== 'web') {
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permission.granted) {
          setDictationError('Allow microphone access to use speech to text.');
          setStartingDictation(false);
          return;
        }
      }

      dictationBase.current = draft;
      ExpoSpeechRecognitionModule.start({
        lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      });
    } catch {
      setStartingDictation(false);
      setListening(false);
      setDictationError('Speech recognition is unavailable right now.');
    }
  }

  function submitMessage() {
    if (listening || startingDictation) ExpoSpeechRecognitionModule.abort();
    setAttachmentMenuOpen(false);
    onSend();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.chrome,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={8}
          style={styles.headerHit}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${data.peer.displayName}'s profile`}
          disabled={!data.peer.handle}
          onPress={() => {
            if (data.peer.handle) onOpenProfile(data.peer.handle);
          }}
          style={styles.identity}
        >
          <ChatAvatar person={data.peer} size={38} />
          <View style={styles.identityCopy}>
            <AppText weight="700" numberOfLines={1}>
              {data.peer.displayName}
            </AppText>
            {data.peer.handle ? (
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                @{data.peer.handle}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.headerHit} />
      </View>

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
              <MessageRow turn={turn} peer={data.peer} me={data.me} />
            </React.Fragment>
          ))
        ) : (
          <View style={styles.hello}>
            <ChatAvatar person={data.peer} size={72} />
            <AppText variant="heading" weight="700" align="center">
              {data.peer.displayName}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Start your conversation on Macronaut.
            </AppText>
          </View>
        )}
      </ScrollView>

      {data.peer.friendship === 'friends' ? (
        <View
          ref={composerWrapRef}
          style={[
            styles.composerWrap,
            {
              backgroundColor: colors.background,
              paddingBottom: composerPad,
              transform: [{ translateY: composerShift }],
            },
          ]}
        >
          {error || dictationError ? (
            <AppText variant="caption" tone="danger" style={styles.error}>
              {error ?? dictationError}
            </AppText>
          ) : null}

          {attachment ? (
            <AttachmentPreview
              attachment={attachment}
              busy={sending}
              onRemove={onRemoveAttachment}
            />
          ) : null}

          <Animated.View
            pointerEvents={attachmentMenuOpen ? 'auto' : 'none'}
            accessibilityElementsHidden={!attachmentMenuOpen}
            importantForAccessibility={attachmentMenuOpen ? 'auto' : 'no-hide-descendants'}
            style={[styles.attachmentMenuClip, { height: menuHeight, opacity: menuOpacity }]}
          >
            <View style={[styles.attachmentMenu, { backgroundColor: colors.surfaceRaised }]}>
              <AttachmentAction
                icon="images-outline"
                label="Photos"
                onPress={() => {
                  setAttachmentMenuOpen(false);
                  onAttach();
                }}
              />
              <AttachmentAction
                icon="camera-outline"
                label="Camera"
                onPress={() => {
                  setAttachmentMenuOpen(false);
                  onTakePhoto();
                }}
              />
              <AttachmentAction
                icon="sparkles-outline"
                label="GIF"
                onPress={() => {
                  setAttachmentMenuOpen(false);
                  onOpenGiphy();
                }}
              />
              <AttachmentAction
                icon="location-outline"
                label="Location"
                onPress={() => {
                  setAttachmentMenuOpen(false);
                  onOpenMaps();
                }}
              />
            </View>
          </Animated.View>

          <View style={styles.composer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                attachmentMenuOpen ? 'Close attachment menu' : 'Open attachment menu'
              }
              accessibilityState={{ expanded: attachmentMenuOpen }}
              disabled={sending}
              onPress={() => setAttachmentMenuOpen((open) => !open)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.composerHit,
                { opacity: sending ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: plusRotation }] }}>
                <Ionicons name="add" size={28} color={colors.textSecondary} />
              </Animated.View>
            </Pressable>

            <View style={[styles.inputWrap, { backgroundColor: colors.track }]}>
              <TextInput
                accessibilityLabel={`Message ${data.peer.displayName}`}
                value={draft}
                onChangeText={(value) => {
                  setDictationError(null);
                  onDraft(value);
                }}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                maxLength={2000}
                returnKeyType="send"
                onFocus={onComposerFocus}
                onBlur={onComposerBlur}
                onSubmitEditing={() => {
                  if (canSend) submitMessage();
                }}
                style={[styles.input, { color: colors.textPrimary }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Stop voice typing' : 'Start voice typing'}
                accessibilityState={{ busy: startingDictation, selected: listening }}
                disabled={sending || startingDictation}
                onPress={() => void toggleDictation()}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.dictationHit,
                  listening && { backgroundColor: colors.surface },
                  { opacity: sending ? 0.35 : pressed ? 0.6 : 1 },
                ]}
              >
                {startingDictation ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons
                    name={listening ? 'mic' : 'mic-outline'}
                    size={20}
                    color={listening ? colors.accent : colors.textSecondary}
                  />
                )}
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!canSend}
              onPress={submitMessage}
              hitSlop={6}
              style={({ pressed }) => [
                styles.composerHit,
                { opacity: canSend ? (pressed ? 0.6 : 1) : 0.35 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="arrow-up" size={24} color={colors.accent} />
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <FriendGate
          friendship={data.peer.friendship}
          name={data.peer.displayName}
          busy={addingFriend}
          bottom={Math.max(insets.bottom, spacing.sm)}
          error={error}
          onAdd={onAddFriend}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function AttachmentAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.attachmentAction, pressed && styles.actionPressed]}
    >
      <View style={[styles.attachmentActionIcon, { backgroundColor: colors.track }]}>
        <Ionicons name={icon} size={21} color={colors.textPrimary} />
      </View>
      <AppText variant="micro" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** What the composer is holding, with a way to drop it again. */
function AttachmentPreview({
  attachment,
  busy,
  onRemove,
}: {
  attachment: PickedAttachment;
  busy: boolean;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.previewRow}>
      <View style={[styles.preview, { backgroundColor: colors.surfaceRaised }]}>
        <Image
          source={{ uri: attachment.previewUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        {attachment.kind === 'video' ? (
          <View style={styles.previewBadge}>
            <Ionicons name="videocam" size={16} color="#FFFFFF" style={styles.onMediaGlyph} />
          </View>
        ) : null}
        {busy ? (
          <View style={[StyleSheet.absoluteFill, styles.previewBusy]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.previewCopy}>
        <AppText variant="caption" weight="600" numberOfLines={1}>
          {attachment.kind === 'video' ? 'Video ready to send' : 'Photo ready to send'}
        </AppText>
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          Add a message, or send it on its own.
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove attachment"
        disabled={busy}
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => [styles.composerHit, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
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

function FriendGate({
  friendship,
  name,
  busy,
  bottom,
  error,
  onAdd,
}: {
  friendship: 'none' | 'outgoing' | 'incoming';
  name: string;
  busy: boolean;
  bottom: number;
  error: string | null;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  const incoming = friendship === 'incoming';
  return (
    <View
      style={[
        styles.friendGateWrap,
        {
          backgroundColor: colors.chrome,
          borderTopColor: colors.border,
          paddingBottom: bottom,
        },
      ]}
    >
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.friendGate}>
        <View style={{ flex: 1 }}>
          <AppText weight="700">Friends can message</AppText>
          <AppText variant="caption" tone="muted">
            {friendship === 'outgoing'
              ? `Your request is waiting for ${name}.`
              : incoming
                ? `${name} sent you a friend request.`
                : `Add ${name} as a friend before sending a message.`}
          </AppText>
        </View>
        {friendship === 'outgoing' ? null : (
          <Button
            compact
            title={incoming ? 'Accept' : 'Add friend'}
            loading={busy}
            onPress={onAdd}
          />
        )}
      </View>
    </View>
  );
}

/** One message: avatar gutter, bubble, and the time under the last of a run. */
function MessageRow({
  turn,
  peer,
  me,
}: {
  turn: ChatTurn;
  peer: ChatPerson;
  me: ChatPerson | null;
}) {
  const { message, first, last } = turn;
  const mine = message.isMine;
  const person = mine ? me : peer;

  return (
    <View style={first ? styles.turnFirst : styles.turn}>
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={styles.gutter}>
          {last && person ? <ChatAvatar person={person} size={ROW_AVATAR} /> : null}
        </View>
        <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : null]}>
          <MessageBubble message={message} last={last} />
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
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
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
  error: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  composerHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: touchTarget / 2,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs,
  },
  input: {
    ...type.body,
    flex: 1,
    height: touchTarget,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0 } as object,
      default: {},
    }),
  },
  dictationHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMenuClip: {
    overflow: 'hidden',
  },
  attachmentMenu: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  attachmentAction: {
    width: 56,
    alignItems: 'center',
    gap: 3,
  },
  attachmentActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  preview: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadge: {
    position: 'absolute',
    right: 3,
    bottom: 2,
  },
  previewBusy: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,9,12,0.55)',
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  onMediaGlyph: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  friendGateWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  friendGate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
