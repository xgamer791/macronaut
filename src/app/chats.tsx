import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ChatSummary } from '@/repositories/chatRepo';
import type { GroupChatSummary } from '@/repositories/groupChatRepo';
import { useChats, useGroupChats } from '@/state/queries';
import {
  AppText,
  ChatAvatar,
  ChatPeopleList,
  EmptyState,
  GroupIdentity,
  Screen,
  ScreenHeader,
} from '@/ui/components';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';

export default function ChatsScreen() {
  return (
    <SlideScreen from="left">
      <ChatList />
    </SlideScreen>
  );
}

/** One list of conversations, direct and group alike, newest activity first. */
type ListRow =
  | { key: string; at: string; kind: 'direct'; chat: ChatSummary }
  | { key: string; at: string; kind: 'group'; chat: GroupChatSummary };

function matchesDirect(chat: ChatSummary, wanted: string): boolean {
  return (
    chat.peer.displayName.toLowerCase().includes(wanted) ||
    (chat.peer.handle ?? '').toLowerCase().includes(wanted) ||
    Boolean(chat.lastMessage?.body.toLowerCase().includes(wanted))
  );
}

function matchesGroup(chat: GroupChatSummary, wanted: string): boolean {
  return (
    chat.group.name.toLowerCase().includes(wanted) ||
    chat.group.handle.toLowerCase().includes(wanted) ||
    Boolean(chat.lastMessage?.body.toLowerCase().includes(wanted)) ||
    Boolean(chat.lastMessage?.senderName.toLowerCase().includes(wanted))
  );
}

function ChatList() {
  const router = useRouter();
  const { colors } = useTheme();
  const chats = useChats();
  const groupChats = useGroupChats();
  const [search, setSearch] = useState('');
  const wanted = search.trim().toLowerCase();
  const list = useMemo(() => {
    const rows: ListRow[] = [
      ...(chats.data ?? [])
        .filter((chat) => !wanted || matchesDirect(chat, wanted))
        .map<ListRow>((chat) => ({
          key: `direct:${chat.id}`,
          at: chat.lastMessage?.createdAt ?? chat.updatedAt,
          kind: 'direct',
          chat,
        })),
      ...(groupChats.data ?? [])
        .filter((chat) => !wanted || matchesGroup(chat, wanted))
        .map<ListRow>((chat) => ({
          key: `group:${chat.group.id}`,
          at: chat.lastMessageAt,
          kind: 'group',
          chat,
        })),
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [chats.data, groupChats.data, wanted]);

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
              style={styles.add}
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
            placeholder="Search chats and people on Macronaut"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
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

      {chats.isLoading || groupChats.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          {list.length ? (
            <View>
              {wanted ? (
                <AppText variant="caption" weight="700" tone="secondary" style={styles.label}>
                  CHATS
                </AppText>
              ) : null}
              {list.map((row) =>
                row.kind === 'direct' ? (
                  <ChatRow
                    key={row.key}
                    chat={row.chat}
                    onPress={() =>
                      router.push({ pathname: '/chat/[id]', params: { id: row.chat.id } })
                    }
                  />
                ) : (
                  <GroupChatRow
                    key={row.key}
                    chat={row.chat}
                    onPress={() =>
                      router.push({
                        pathname: '/group-chat/[id]',
                        params: { id: row.chat.group.id },
                      })
                    }
                  />
                ),
              )}
            </View>
          ) : null}

          {/* Typing looks past your own conversations and into the database. */}
          <ChatPeopleList
            search={search}
            enabled={Boolean(wanted)}
            label="PEOPLE ON MACRONAUT"
            empty={
              list.length ? undefined : (
                <EmptyState title="No people found" body="Try a different name or @handle." />
              )
            }
          />

          {!wanted && list.length === 0 ? (
            <EmptyState
              title="No chats yet"
              body="Start a conversation with a contact or find someone on Macronaut."
              actionTitle="Start a chat"
              onAction={() => router.push('/new-chat')}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** What a row shows for the last message. An attachment sent on its own has
 * no text, so it is named instead of leaving the row blank. */
function previewOf(last: ChatSummary['lastMessage']): string {
  if (!last) return 'Conversation started';
  const body = last.body || (last.media?.kind === 'video' ? 'Video' : last.media ? 'Photo' : '');
  return `${last.isMine ? 'You: ' : ''}${body}`;
}

/** A group row names who spoke last: with many voices, the text alone does not. */
function groupPreviewOf(last: GroupChatSummary['lastMessage']): string {
  if (!last) return 'No messages yet';
  const body = last.body || (last.mediaKind === 'video' ? 'Video' : 'Photo');
  return `${last.isMine ? 'You' : last.senderName}: ${body}`;
}

function ChatRow({ chat, onPress }: { chat: ChatSummary; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${chat.peer.displayName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chatRow, pressed && { opacity: 0.65 }]}
    >
      <ChatAvatar person={chat.peer} />
      <RowCopy
        title={chat.peer.displayName}
        time={chatTime(chat.lastMessage?.createdAt ?? chat.updatedAt)}
        preview={previewOf(chat.lastMessage)}
        unread={chat.unreadCount}
        borderColor={colors.border}
      />
    </Pressable>
  );
}

function GroupChatRow({ chat, onPress }: { chat: GroupChatSummary; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${chat.group.name} group chat`}
      onPress={onPress}
      style={({ pressed }) => [styles.chatRow, pressed && { opacity: 0.65 }]}
    >
      <GroupIdentity group={chat.group} size={54} />
      <RowCopy
        title={chat.group.name}
        time={chatTime(chat.lastMessageAt)}
        preview={groupPreviewOf(chat.lastMessage)}
        unread={chat.unreadCount}
        borderColor={colors.border}
      />
    </Pressable>
  );
}

/** The words of a row: name and time on top, preview and unread pill under. */
function RowCopy({
  title,
  time,
  preview,
  unread,
  borderColor,
}: {
  title: string;
  time: string;
  preview: string;
  unread: number;
  borderColor: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chatCopy, { borderBottomColor: borderColor }]}>
      <View style={styles.chatTopline}>
        <AppText
          variant="body"
          weight={unread ? '700' : '600'}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {title}
        </AppText>
        <AppText variant="caption" tone={unread ? 'primary' : 'muted'}>
          {time}
        </AppText>
      </View>
      <View style={styles.previewRow}>
        <AppText
          variant="body"
          tone={unread ? 'primary' : 'muted'}
          weight={unread ? '600' : '400'}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {preview}
        </AppText>
        {unread ? (
          <View style={[styles.unread, { backgroundColor: colors.accent }]}>
            <AppText variant="micro" weight="700" style={{ color: colors.onAccent }}>
              {unread > 99 ? '99+' : unread}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
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
  label: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    letterSpacing: 0.5,
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
