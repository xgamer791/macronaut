import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ChatPerson, ChatSummary } from '@/repositories/chatRepo';
import { useChatPeople, useChats, useOpenChat, useSetProfileFollow } from '@/state/queries';
import {
  AppText,
  ChatAvatar,
  ChatPersonRow,
  EmptyState,
  Screen,
  ScreenHeader,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';

export default function ChatsScreen() {
  return <ChatList />;
}

function ChatList() {
  const router = useRouter();
  const { colors } = useTheme();
  const chats = useChats();
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [friending, setFriending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wanted = search.trim().toLowerCase();
  const people = useChatPeople(search, Boolean(wanted));
  const openChat = useOpenChat();
  const setFriend = useSetProfileFollow();
  const list = useMemo(
    () =>
      (chats.data ?? []).filter(
        (chat) =>
          !wanted ||
          chat.peer.displayName.toLowerCase().includes(wanted) ||
          chat.peer.handle.toLowerCase().includes(wanted) ||
          chat.lastMessage?.body.toLowerCase().includes(wanted),
      ),
    [chats.data, wanted],
  );
  const peopleList = useMemo(() => {
    const chatHandles = new Set(list.map((chat) => chat.peer.handle));
    return (people.data ?? []).filter((person) => !chatHandles.has(person.handle));
  }, [list, people.data]);

  async function message(person: ChatPerson) {
    setOpening(person.handle);
    setError(null);
    try {
      const chat = await openChat.mutateAsync(person.handle);
      router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start that chat.');
      setOpening(null);
    }
  }

  async function addFriend(person: ChatPerson) {
    setFriending(person.handle);
    setError(null);
    try {
      await setFriend.mutateAsync({ handle: person.handle, follow: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that friend request.');
    } finally {
      setFriending(null);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <ScreenHeader
          title="Chats"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new chat"
              onPress={() => router.push('/new-chat')}
              hitSlop={8}
              style={[styles.add, { backgroundColor: colors.surfaceRaised }]}
            >
              <Ionicons name="add" size={27} color={colors.textPrimary} />
            </Pressable>
          }
        />
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search chats and people on Macronaut"
            value={search}
            onChangeText={setSearch}
            placeholder="Search chats or people"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
          {search ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {!wanted && chats.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !wanted && list.length === 0 ? (
        <EmptyState
          title="No chats yet"
          body="Start a conversation with a friend or find someone on Macronaut."
          actionTitle="Find friends"
          onAction={() => router.push('/new-chat')}
        />
      ) : !wanted ? (
        <View>
          {list.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chat.id } })}
            />
          ))}
        </View>
      ) : chats.isLoading && people.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <View>
          {list.length ? (
            <>
              <AppText variant="caption" weight="700" tone="secondary" style={styles.sectionLabel}>
                CHATS
              </AppText>
              {list.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chat.id } })}
                />
              ))}
            </>
          ) : null}

          <AppText variant="caption" weight="700" tone="secondary" style={styles.sectionLabel}>
            PEOPLE ON MACRONAUT
          </AppText>
          {people.isLoading ? (
            <View style={styles.peopleLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : peopleList.length ? (
            peopleList.map((person) => (
              <ChatPersonRow
                key={person.handle}
                person={person}
                busy={opening === person.handle || friending === person.handle}
                disabled={opening !== null || friending !== null}
                onProfile={() => router.push(`/u/${person.handle}`)}
                onAddFriend={() => void addFriend(person)}
                onAcceptFriend={() => void addFriend(person)}
                onMessage={() => void message(person)}
              />
            ))
          ) : !list.length ? (
            <EmptyState title="No people found" body="Try a different name or @handle." />
          ) : (
            <AppText variant="caption" tone="muted" style={styles.noMorePeople}>
              No additional people found.
            </AppText>
          )}
        </View>
      )}
    </Screen>
  );
}

function ChatRow({ chat, onPress }: { chat: ChatSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const preview = chat.lastMessage
    ? `${chat.lastMessage.isMine ? 'You: ' : ''}${chat.lastMessage.body}`
    : 'Conversation started';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${chat.peer.displayName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chatRow, pressed && { opacity: 0.65 }]}
    >
      <ChatAvatar person={chat.peer} />
      <View style={[styles.chatCopy, { borderBottomColor: colors.border }]}>
        <View style={styles.chatTopline}>
          <AppText
            variant="body"
            weight={chat.unreadCount ? '700' : '600'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {chat.peer.displayName}
          </AppText>
          <AppText variant="caption" tone={chat.unreadCount ? 'primary' : 'muted'}>
            {chatTime(chat.lastMessage?.createdAt ?? chat.updatedAt)}
          </AppText>
        </View>
        <View style={styles.previewRow}>
          <AppText
            variant="body"
            tone={chat.unreadCount ? 'primary' : 'muted'}
            weight={chat.unreadCount ? '600' : '400'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {preview}
          </AppText>
          {chat.unreadCount ? (
            <View style={[styles.unread, { backgroundColor: colors.accent }]}>
              <AppText variant="micro" weight="700" style={{ color: colors.onAccent }}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function chatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const age = now.getTime() - date.getTime();
  if (age < 6 * 86_400_000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
  },
  add: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  search: {
    minHeight: touchTarget,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0 } as object,
      default: {},
    }),
  },
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  peopleLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  error: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  noMorePeople: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chatRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
  },
  chatCopy: {
    flex: 1,
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: 3,
    paddingRight: spacing.lg,
  },
  chatTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
