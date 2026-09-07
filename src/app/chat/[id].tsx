import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMessage } from '@/repositories/chatRepo';
import { useAuth } from '@/state/AuthProvider';
import { useChatThread, useMarkChatRead, useSendChatMessage } from '@/state/queries';
import { AppText, ChatAvatar, EmptyState } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';
import { goBackOrHome } from '@/utils/navigation';

export default function ChatScreen() {
  return <Conversation />;
}

function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const thread = useChatThread(chatId);
  const send = useSendChatMessage();
  const { mutate: markRead } = useMarkChatRead();
  const scroll = useRef<ScrollView>(null);
  const lastMarkedRead = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const marker = thread.data?.unreadCount ? `${chatId}:${thread.data.updatedAt}` : null;
    if (!marker || lastMarkedRead.current === marker) return;
    lastMarkedRead.current = marker;
    markRead(chatId);
  }, [chatId, markRead, thread.data?.unreadCount, thread.data?.updatedAt]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync({ id: chatId, body });
      setDraft('');
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
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

  const data = thread.data;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBackOrHome(router)}
          hitSlop={8}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${data.peer.displayName}'s profile`}
          onPress={() => router.push(`/u/${data.peer.handle}`)}
          style={styles.identity}
        >
          <ChatAvatar person={data.peer} size={36} />
          <View style={{ flex: 1 }}>
            <AppText weight="700" numberOfLines={1}>
              {data.peer.displayName}
            </AppText>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              @{data.peer.handle}
            </AppText>
          </View>
        </Pressable>
        <View style={styles.back} />
      </View>

      <ScrollView
        ref={scroll}
        style={styles.messages}
        contentContainerStyle={[
          styles.messageContent,
          !data.messages.length && styles.emptyMessages,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {data.messages.length ? (
          data.messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <View style={styles.hello}>
            <ChatAvatar person={data.peer} size={68} />
            <AppText variant="heading" weight="700" align="center">
              {data.peer.displayName}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Start your conversation on Macronaut.
            </AppText>
          </View>
        )}
      </ScrollView>

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <TextInput
          accessibilityLabel={`Message ${data.peer.displayName}`}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          style={[
            styles.input,
            { color: colors.textPrimary, backgroundColor: colors.surfaceRaised },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!draft.trim() || send.isPending}
          onPress={() => void sendMessage()}
          style={[
            styles.send,
            {
              backgroundColor: colors.accent,
              opacity: draft.trim() && !send.isPending ? 1 : 0.4,
            },
          ]}
        >
          {send.isPending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.messageRow, message.isMine ? styles.mineRow : styles.theirRow]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: message.isMine ? colors.accent : colors.surfaceRaised,
            borderBottomRightRadius: message.isMine ? 5 : radius.lg,
            borderBottomLeftRadius: message.isMine ? radius.lg : 5,
          },
        ]}
      >
        <AppText style={{ color: message.isMine ? colors.onAccent : colors.textPrimary }}>
          {message.body}
        </AppText>
        <AppText
          variant="micro"
          align="right"
          style={{
            color: message.isMine ? colors.onAccent : colors.textMuted,
            opacity: message.isMine ? 0.75 : 1,
          }}
        >
          {messageTime(message.createdAt)}
        </AppText>
      </View>
    </View>
  );
}

function messageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  back: {
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
  messages: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyMessages: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hello: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xxl,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  error: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  input: {
    ...type.body,
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 10,
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0 } as object,
      default: {},
    }),
  },
  send: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
