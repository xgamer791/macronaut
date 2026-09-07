import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ChatPerson } from '@/repositories/chatRepo';
import { useChatPeople, useOpenChat, useSetProfileFollow } from '@/state/queries';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { ChatPersonRow } from './ChatPersonRow';

export interface ChatPeopleListProps {
  /** Blank lists your contacts; anything else searches the Macronaut database. */
  search: string;
  /** Skip the round trip entirely — the Chats page only asks while searching. */
  enabled?: boolean;
  /** Small caps heading above the rows. */
  label?: string;
  /** Rendered when the query comes back with nobody. Without one the whole
   * block disappears instead, which is what a page with its own empty state
   * wants. */
  empty?: React.ReactNode;
  /** `replace` when the picker should not sit behind the thread it opened. */
  navigate?: 'push' | 'replace';
}

/**
 * People from the database, each with the one action their friendship allows:
 * add, accept, or — only once you are friends both ways — message.
 *
 * Shared by the Chats page and the new-chat picker so the two can never
 * disagree about who is findable or what you may do with them.
 */
export function ChatPeopleList({
  search,
  enabled = true,
  label,
  empty,
  navigate = 'push',
}: ChatPeopleListProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [opening, setOpening] = useState<string | null>(null);
  const [friending, setFriending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = useChatPeople(useDebounced(search), enabled);
  const openChat = useOpenChat();
  const setFriend = useSetProfileFollow();

  async function message(person: ChatPerson) {
    if (person.friendship !== 'friends') return;
    setOpening(person.id);
    setError(null);
    try {
      const chat = await openChat.mutateAsync(person.id);
      const to = { pathname: '/chat/[id]' as const, params: { id: chat.id } };
      if (navigate === 'replace') router.replace(to);
      else router.push(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start that chat.');
    } finally {
      setOpening(null);
    }
  }

  async function addFriend(person: ChatPerson) {
    setFriending(person.id);
    setError(null);
    try {
      await setFriend.mutateAsync({ userId: person.id, follow: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that friend request.');
    } finally {
      setFriending(null);
    }
  }

  if (!enabled) return null;

  if (people.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const rows = people.data ?? [];
  if (!rows.length && !empty) return null;

  return (
    <View>
      {label ? (
        <AppText variant="caption" weight="700" tone="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {rows.length
        ? rows.map((person) => (
            <ChatPersonRow
              key={person.id}
              person={person}
              busy={opening === person.id || friending === person.id}
              disabled={opening !== null || friending !== null}
              onProfile={() => {
                if (person.handle) router.push(`/u/${person.handle}`);
              }}
              onAddFriend={() => void addFriend(person)}
              onAcceptFriend={() => void addFriend(person)}
              onMessage={() => void message(person)}
            />
          ))
        : empty}
    </View>
  );
}

/**
 * Searching asks the server to look at every profile row, so it waits for a
 * pause in the typing rather than firing once per keystroke.
 */
function useDebounced(value: string, ms = 250): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, settled, ms]);
  return settled;
}

const styles = StyleSheet.create({
  label: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  error: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
});
