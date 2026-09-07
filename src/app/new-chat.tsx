import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ChatPerson } from '@/repositories/chatRepo';
import { useChatPeople, useOpenChat, useSetProfileFollow } from '@/state/queries';
import { AppText, ChatPersonRow, EmptyState, Screen, ScreenHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';

export default function NewChatScreen() {
  return <PeopleList />;
}

function PeopleList() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [friending, setFriending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = useChatPeople(search);
  const openChat = useOpenChat();
  const setFriend = useSetProfileFollow();
  const searching = Boolean(search.trim());

  async function select(person: ChatPerson) {
    if (person.friendship !== 'friends') return;
    setOpening(person.handle);
    setError(null);
    try {
      const chat = await openChat.mutateAsync(person.handle);
      router.replace({ pathname: '/chat/[id]', params: { id: chat.id } });
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
        <ScreenHeader title="New chat" />
      </View>
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            autoFocus
            accessibilityLabel="Search people on Macronaut"
            value={search}
            onChangeText={setSearch}
            placeholder="Search people on Macronaut"
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

      <AppText variant="caption" weight="700" tone="secondary" style={styles.sectionLabel}>
        {searching ? 'PEOPLE ON MACRONAUT' : 'CONTACTS'}
      </AppText>

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {people.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !people.data?.length ? (
        <EmptyState
          title={searching ? 'No people found' : 'No contacts yet'}
          body={
            searching
              ? 'Try a different name or @handle.'
              : 'Search for someone on Macronaut to start your first conversation.'
          }
        />
      ) : (
        <View>
          {people.data.map((person) => (
            <ChatPersonRow
              key={person.handle}
              person={person}
              busy={opening === person.handle || friending === person.handle}
              disabled={opening !== null || friending !== null}
              onProfile={() => router.push(`/u/${person.handle}`)}
              onAddFriend={() => void addFriend(person)}
              onAcceptFriend={() => void addFriend(person)}
              onMessage={() => void select(person)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
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
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  error: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
