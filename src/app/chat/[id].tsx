import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatThread } from '@/repositories/chatRepo';
import { pickAttachment, takePhotoAttachment } from '@/services/media/pickAttachment';
import type { PickedAttachment } from '@/services/media/pickedAttachment';
import { useAuth } from '@/state/AuthProvider';
import {
  useChatThread,
  useMarkChatRead,
  useSendChatMessage,
  useSetProfileFollow,
} from '@/state/queries';
import { MessageComposer } from '@/ui/chat/MessageComposer';
import { MessageList } from '@/ui/chat/MessageList';
import { AppText, Button, ChatAvatar, EmptyState } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';

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

      <MessageList
        messages={data.messages}
        me={data.me}
        peer={data.peer}
        empty={
          <>
            <ChatAvatar person={data.peer} size={72} />
            <AppText variant="heading" weight="700" align="center">
              {data.peer.displayName}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Start your conversation on Macronaut.
            </AppText>
          </>
        }
      />

      {data.peer.friendship === 'friends' ? (
        <MessageComposer
          draft={draft}
          onDraft={onDraft}
          attachment={attachment}
          onAttach={onAttach}
          onTakePhoto={onTakePhoto}
          onOpenGiphy={onOpenGiphy}
          onOpenMaps={onOpenMaps}
          onRemoveAttachment={onRemoveAttachment}
          onSend={onSend}
          sending={sending}
          error={error}
          accessibilityLabel={`Message ${data.peer.displayName}`}
        />
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
  error: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
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
