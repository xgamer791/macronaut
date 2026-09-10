import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ConnectionPerson, ConnectionTab } from '@/repositories/profileRepo';
import { useAuth } from '@/state/AuthProvider';
import { useConnections, useOpenChat, useSetProfileFollow } from '@/state/queries';
import {
  AppText,
  ChatPersonRow,
  EmptyState,
  GlassHeaderBar,
  Screen,
  ScreenHeader,
} from '@/ui/components';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';
import { followerLabel, followingLabel, friendLabel } from '@/utils/compactCount';

const TABS: { value: ConnectionTab; label: string }[] = [
  { value: 'followers', label: 'Followers' },
  { value: 'following', label: 'Following' },
  { value: 'friends', label: 'Friends' },
];

function tabFrom(value: string | string[] | undefined): ConnectionTab {
  const wanted = Array.isArray(value) ? value[0] : value;
  return TABS.some((tab) => tab.value === wanted) ? (wanted as ConnectionTab) : 'followers';
}

/**
 * The people around a profile — its followers, who it follows, and the mutual
 * follows that make a friend. Opened by tapping either count under a name, so
 * it arrives from the left with the page it came from sliding out beside it.
 */
export default function ConnectionsScreen() {
  return (
    <SlideScreen from="left">
      <Connections />
    </SlideScreen>
  );
}

function Connections() {
  const { handle, tab: startTab } = useLocalSearchParams<{ handle?: string; tab?: string }>();
  const router = useRouter();
  const onBack = useSlideBack();
  const { colors } = useTheme();
  const { signedIn } = useAuth();

  const subjectHandle = (Array.isArray(handle) ? handle[0] : handle) ?? '';
  const [tab, setTab] = useState<ConnectionTab>(() => tabFrom(startTab));
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Searching asks the server to look at the whole list rather than the page
  // that arrived, so it waits for a pause in the typing.
  const result = useConnections(subjectHandle, tab, useDebounced(search));
  const openChat = useOpenChat();
  const setFriend = useSetProfileFollow();

  const data = result.data;
  const counts = data?.counts;
  const people = data?.people ?? [];
  const wanted = search.trim();

  async function message(person: ConnectionPerson) {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    if (person.friendship !== 'friends') return;
    setBusyId(person.id);
    setError(null);
    try {
      const chat = await openChat.mutateAsync({ userId: person.id });
      router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start that chat.');
    } finally {
      setBusyId(null);
    }
  }

  async function addFriend(person: ConnectionPerson) {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    setBusyId(person.id);
    setError(null);
    try {
      await setFriend.mutateAsync({ userId: person.id, follow: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that friend request.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen
      padded={false}
      scroll
      safeTop={false}
      collapseHeader={false}
      stickyHeader={
        <GlassHeaderBar inset={spacing.lg}>
          <ScreenHeader title={data?.subject.displayName ?? 'People'} onBack={onBack} />
        </GlassHeaderBar>
      }
    >
      <View style={styles.tabs}>
        {TABS.map((option) => (
          <TabChip
            key={option.value}
            label={option.label}
            selected={option.value === tab}
            onPress={() => {
              setTab(option.value);
              setSearch('');
            }}
          />
        ))}
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
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

      {counts ? (
        <AppText variant="title" weight="700" display style={styles.count}>
          {tab === 'followers'
            ? followerLabel(counts.followers)
            : tab === 'following'
              ? followingLabel(counts.following)
              : friendLabel(counts.friends)}
        </AppText>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {result.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !data ? (
        <EmptyState
          title="Not available"
          body={
            subjectHandle
              ? `Nobody at @${subjectHandle} has a public profile, or their page is private.`
              : 'Sign in to see the people around your profile.'
          }
          actionTitle="Back"
          onAction={onBack}
        />
      ) : people.length ? (
        people.map((person) => (
          <ChatPersonRow
            key={person.id}
            person={person}
            showAction={!person.isYou}
            busy={busyId === person.id}
            disabled={busyId !== null}
            onProfile={() => {
              if (person.handle) router.push(`/u/${person.handle}`);
            }}
            onAddFriend={() => void addFriend(person)}
            onAcceptFriend={() => void addFriend(person)}
            onMessage={() => void message(person)}
          />
        ))
      ) : (
        <EmptyState title={emptyTitle(tab, wanted)} body={emptyBody(tab, wanted, data.subject)} />
      )}
    </Screen>
  );
}

function emptyTitle(tab: ConnectionTab, search: string): string {
  if (search) return 'No people found';
  return tab === 'followers'
    ? 'No followers yet'
    : tab === 'following'
      ? 'Not following anyone yet'
      : 'No friends yet';
}

function emptyBody(tab: ConnectionTab, search: string, subject: { displayName: string }): string {
  if (search) return 'Try a different name or @handle.';
  const who = subject.displayName;
  return tab === 'followers'
    ? `Nobody follows ${who} yet.`
    : tab === 'following'
      ? `${who} does not follow anybody yet.`
      : 'A friend is a follow that goes both ways.';
}

/** The Followers / Following / Friends switch. Wider than the shared Chip so
 * three of them fill the row evenly, which is what the reference does. */
function TabChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          backgroundColor: selected ? colors.accent : colors.surfaceRaised,
          borderColor: selected ? colors.accent : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText
        variant="caption"
        weight="600"
        align="center"
        numberOfLines={1}
        tone={selected ? 'onAccent' : 'secondary'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** Waits for a pause in the typing before the term reaches the server. */
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  count: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
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
