import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { FitnessGroup, GroupMember, NewGroup } from '@/repositories/groupRepo';
import type { MyGym } from '@/repositories/gymRepo';
import { useAuth } from '@/state/AuthProvider';
import {
  useCreateGroup,
  useDeleteGroup,
  useGroupChats,
  useGroupDiscovery,
  useGroupMembers,
  useJoinGroup,
  useJoinGymGroup,
  useLeaveGroup,
  useMyGroups,
  useMyGym,
  usePublicGroups,
  useRetractVote,
  useUpdateGroup,
  useVoteRemove,
} from '@/state/queries';
import {
  AppText,
  Button,
  Card,
  ChatAvatar,
  EmptyState,
  GroupIdentity,
  Screen,
  ScreenHeader,
  Sheet,
  TextField,
  gradientFor,
  groupMeta,
} from '@/ui/components';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';
import { GYM_VOTE_RULES, nextThreshold, untilLabel } from '../../convex/lib/gymVotes';

type GroupsPage = 'for-you' | 'yours' | 'discover' | 'manage';

const PAGES: { id: GroupsPage; label: string }[] = [
  { id: 'for-you', label: 'For you' },
  { id: 'yours', label: 'Yours' },
  { id: 'discover', label: 'Discover' },
  { id: 'manage', label: 'Manage' },
];

/** The Groups destination replaces the old notification tab and enters along
 * the same right-to-left path that tab used. */
export default function GroupsScreen() {
  return (
    <SlideScreen from="right">
      <GroupsList />
    </SlideScreen>
  );
}

function GroupsList() {
  const { handle } = useLocalSearchParams<{ handle?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const own = useMyGroups();
  const discovery = useGroupDiscovery();
  const other = usePublicGroups(handle ?? '');
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();
  const myGym = useMyGym();
  const joinGymGroup = useJoinGymGroup();

  const [page, setPage] = useState<GroupsPage>('for-you');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FitnessGroup | null>(null);
  const [open, setOpen] = useState<FitnessGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (handle) {
    return (
      <ProfileGroups
        handle={handle}
        data={other.data}
        loading={other.isLoading}
        onOpen={setOpen}
        detail={open}
        onCloseDetail={() => setOpen(null)}
        onJoin={async (group) => {
          if (!signedIn) {
            router.push('/login');
            return;
          }
          const joined = await joinGroup.mutateAsync(group.id);
          setOpen(joined);
        }}
        onLeave={async (group) => {
          await leaveGroup.mutateAsync(group.id);
          setOpen(null);
        }}
      />
    );
  }

  const mine = own.data ?? [];
  const discoverable = discovery.data?.groups ?? [];
  const viewerLocation = discovery.data?.viewerLocation;
  const viewerSport = discovery.data?.viewerSport;
  const nearby = discoverable.filter((group) => isNearby(group.location, viewerLocation));
  const recommended = discoverable.slice(0, 8);
  const owned = mine.filter((group) => group.isOwner);
  const joined = mine.filter((group) => !group.isOwner);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? discoverable.filter((group) =>
        [group.name, group.sport, group.location, group.description]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery)),
      )
    : discoverable;

  async function join(group: FitnessGroup) {
    setError(null);
    try {
      const next = await joinGroup.mutateAsync(group.id);
      setOpen((current) => (current?.id === next.id ? next : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join this group.');
    }
  }

  async function leave(group: FitnessGroup) {
    setError(null);
    try {
      await leaveGroup.mutateAsync(group.id);
      setOpen(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not leave this group.');
    }
  }

  async function joinGym() {
    setError(null);
    try {
      setOpen(await joinGymGroup.mutateAsync());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join your gym’s group.');
    }
  }

  return (
    <Screen padded={false} style={styles.screenContent}>
      <View style={styles.headerInset}>
        <ScreenHeader
          title="Groups"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a group"
              onPress={() => setCreateOpen(true)}
              style={[styles.headerAdd, { backgroundColor: colors.surfaceRaised }]}
            >
              <Ionicons name="add" size={25} color={colors.textPrimary} />
            </Pressable>
          }
        />
      </View>

      <LinearGradient
        colors={['#123E35', '#0D201F', '#10171A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroGlow} />
        <View style={styles.heroIcon}>
          <Ionicons name="people" size={25} color="#FFFFFF" />
        </View>
        <View style={styles.heroCopy}>
          <AppText variant="heading" weight="700" style={styles.heroTitle}>
            Train better, together
          </AppText>
          <AppText variant="caption" style={styles.heroBody}>
            {viewerLocation
              ? `Find active communities near ${viewerLocation}.`
              : 'Find active communities near you and around your interests.'}
          </AppText>
        </View>
        <View style={styles.heroStat}>
          <AppText variant="heading" weight="700" style={styles.heroTitle}>
            {mine.length}
          </AppText>
          <AppText variant="micro" style={styles.heroBody}>
            YOUR GROUPS
          </AppText>
        </View>
      </LinearGradient>

      <View style={[styles.pageTabs, { borderBottomColor: colors.border }]}>
        {PAGES.map((item) => {
          const active = page === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => setPage(item.id)}
              style={styles.pageTab}
            >
              <AppText
                variant="caption"
                weight="600"
                style={{ color: active ? colors.accent : colors.textSecondary }}
              >
                {item.label}
              </AppText>
              <View
                style={[
                  styles.pageTabLine,
                  { backgroundColor: active ? colors.accent : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={[styles.error, { backgroundColor: `${colors.danger}18` }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : null}

      {own.isLoading || discovery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <AppText variant="caption" tone="secondary">
            Finding your communities…
          </AppText>
        </View>
      ) : page === 'for-you' ? (
        <ForYouPage
          mine={mine}
          gym={myGym.data ?? null}
          joiningGym={joinGymGroup.isPending}
          recommended={recommended}
          nearby={nearby}
          viewerLocation={viewerLocation}
          viewerSport={viewerSport}
          onChangePage={setPage}
          onCreate={() => setCreateOpen(true)}
          onOpen={setOpen}
          onJoin={(group) => void join(group)}
          onJoinGym={() => void joinGym()}
          onSetGym={() => router.push('/home-gym')}
        />
      ) : page === 'yours' ? (
        <YourGroupsPage groups={mine} onCreate={() => setCreateOpen(true)} onOpen={setOpen} />
      ) : page === 'discover' ? (
        <DiscoverPage
          groups={filtered}
          query={query}
          viewerLocation={viewerLocation}
          onQueryChange={setQuery}
          onOpen={setOpen}
          onJoin={(group) => void join(group)}
        />
      ) : (
        <ManagePage
          owned={owned}
          joined={joined}
          onCreate={() => setCreateOpen(true)}
          onEdit={setEditing}
          onOpen={setOpen}
          onLeave={(group) => void leave(group)}
        />
      )}

      {createOpen ? (
        <GroupEditorSheet
          visible
          defaultLocation={viewerLocation}
          onClose={() => setCreateOpen(false)}
          onSave={async (input) => {
            await createGroup.mutateAsync(input);
            setCreateOpen(false);
          }}
        />
      ) : null}

      {editing ? (
        <GroupEditorSheet
          visible
          group={editing}
          defaultLocation={viewerLocation}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await updateGroup.mutateAsync({ id: editing.id, ...input });
            setEditing(null);
          }}
          onDelete={async () => {
            await deleteGroup.mutateAsync(editing.id);
            setEditing(null);
          }}
        />
      ) : null}

      <GroupDetailsSheet
        group={open}
        onClose={() => setOpen(null)}
        onEdit={(group) => {
          setOpen(null);
          setEditing(group);
        }}
        onJoin={(group) => void join(group)}
        onLeave={(group) => void leave(group)}
        onSetHomeGym={() => {
          setOpen(null);
          router.push('/home-gym');
        }}
        onOpenChat={(group) => {
          setOpen(null);
          router.push({ pathname: '/group-chat/[id]', params: { id: group.id } });
        }}
      />
    </Screen>
  );
}

function ForYouPage({
  mine,
  gym,
  joiningGym,
  recommended,
  nearby,
  viewerLocation,
  viewerSport,
  onChangePage,
  onCreate,
  onOpen,
  onJoin,
  onJoinGym,
  onSetGym,
}: {
  mine: FitnessGroup[];
  gym: MyGym | null;
  joiningGym: boolean;
  recommended: FitnessGroup[];
  nearby: FitnessGroup[];
  viewerLocation?: string;
  viewerSport?: string;
  onChangePage: (page: GroupsPage) => void;
  onCreate: () => void;
  onOpen: (group: FitnessGroup) => void;
  onJoin: (group: FitnessGroup) => void;
  onJoinGym: () => void;
  onSetGym: () => void;
}) {
  return (
    <View style={styles.content}>
      <SectionHeading
        title="Your gym"
        subtitle={gym ? gym.gym.address : 'One group with everyone who trains where you do'}
        action={gym ? 'Change' : undefined}
        onAction={onSetGym}
      />
      {gym ? (
        <YourGymCard
          gym={gym}
          joining={joiningGym}
          onOpen={() => gym.group && onOpen(gym.group)}
          onJoin={onJoinGym}
          onManage={onSetGym}
        />
      ) : (
        <Card style={styles.startCard}>
          <View style={styles.startCopy}>
            <AppText weight="600">Set your home gym</AppText>
            <AppText variant="caption" tone="secondary">
              You’ll be placed in one group with everyone on Macronaut who trains there.
            </AppText>
          </View>
          <Button compact title="Set up" onPress={onSetGym} />
        </Card>
      )}

      <SectionHeading
        title="Your groups"
        subtitle={mine.length ? `${mine.length} communities` : 'Your team starts here'}
        action={mine.length ? 'See all' : undefined}
        onAction={() => onChangePage('yours')}
      />
      {mine.length ? (
        <View style={styles.rowList}>
          {mine.slice(0, 3).map((group) => (
            <GroupRow key={group.id} group={group} onOpen={() => onOpen(group)} />
          ))}
        </View>
      ) : (
        <Card style={styles.startCard}>
          <View style={styles.startCopy}>
            <AppText weight="600">Build your first circle</AppText>
            <AppText variant="caption" tone="secondary">
              Create a local group for training partners, challenges, or accountability.
            </AppText>
          </View>
          <Button compact title="Create" onPress={onCreate} />
        </Card>
      )}

      <SectionHeading
        title="Recommended for you"
        subtitle={
          viewerSport
            ? `Based on ${viewerSport} and nearby activity`
            : 'Popular communities with a local-first ranking'
        }
        action={recommended.length ? 'Explore' : undefined}
        onAction={() => onChangePage('discover')}
      />
      {recommended.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRail}
        >
          {recommended.slice(0, 6).map((group) => (
            <DiscoverCard
              key={group.id}
              group={group}
              nearby={isNearby(group.location, viewerLocation)}
              onOpen={() => onOpen(group)}
              onJoin={() => onJoin(group)}
            />
          ))}
        </ScrollView>
      ) : (
        <DiscoveryEmpty onCreate={onCreate} />
      )}

      {nearby.length ? (
        <>
          <SectionHeading
            title="Closest to you"
            subtitle={viewerLocation ? `Around ${viewerLocation}` : 'Local communities'}
          />
          <View style={styles.rowList}>
            {nearby.slice(0, 4).map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                badge="Nearby"
                action="Join"
                onOpen={() => onOpen(group)}
                onAction={() => onJoin(group)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function YourGroupsPage({
  groups,
  onCreate,
  onOpen,
}: {
  groups: FitnessGroup[];
  onCreate: () => void;
  onOpen: (group: FitnessGroup) => void;
}) {
  return (
    <View style={styles.content}>
      <SectionHeading
        title="Your groups"
        subtitle="Every community you own or have joined"
        action="New group"
        onAction={onCreate}
      />
      {groups.length ? (
        <View style={styles.rowList}>
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              badge={group.kind === 'gym' ? 'Home gym' : group.isOwner ? 'Owner' : 'Member'}
              onOpen={() => onOpen(group)}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No groups yet"
          body="Create a community or discover one nearby to get started."
          actionTitle="Create a group"
          onAction={onCreate}
        />
      )}
    </View>
  );
}

function DiscoverPage({
  groups,
  query,
  viewerLocation,
  onQueryChange,
  onOpen,
  onJoin,
}: {
  groups: FitnessGroup[];
  query: string;
  viewerLocation?: string;
  onQueryChange: (value: string) => void;
  onOpen: (group: FitnessGroup) => void;
  onJoin: (group: FitnessGroup) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.content}>
      <View
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search groups"
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search groups, sports, or places"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onQueryChange('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <SectionHeading
        title={query ? 'Search results' : 'Discover communities'}
        subtitle={
          viewerLocation
            ? `Closest matches to ${viewerLocation} appear first`
            : 'Popular and interest-matched groups appear first'
        }
      />
      {groups.length ? (
        <View style={styles.discoveryGrid}>
          {groups.map((group) => (
            <DiscoverCard
              key={group.id}
              group={group}
              nearby={isNearby(group.location, viewerLocation)}
              fullWidth
              onOpen={() => onOpen(group)}
              onJoin={() => onJoin(group)}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title={query ? 'No matching groups' : 'No public groups yet'}
          body={
            query
              ? 'Try a sport, a city, or a broader keyword.'
              : 'New public groups will appear here as your local community grows.'
          }
        />
      )}
    </View>
  );
}

function ManagePage({
  owned,
  joined,
  onCreate,
  onEdit,
  onOpen,
  onLeave,
}: {
  owned: FitnessGroup[];
  joined: FitnessGroup[];
  onCreate: () => void;
  onEdit: (group: FitnessGroup) => void;
  onOpen: (group: FitnessGroup) => void;
  onLeave: (group: FitnessGroup) => void;
}) {
  return (
    <View style={styles.content}>
      <SectionHeading
        title="Groups you manage"
        subtitle="Edit details, visibility, and community location"
        action="Create"
        onAction={onCreate}
      />
      {owned.length ? (
        <View style={styles.rowList}>
          {owned.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              badge="Owner"
              action="Edit"
              onOpen={() => onOpen(group)}
              onAction={() => onEdit(group)}
            />
          ))}
        </View>
      ) : (
        <Card style={styles.manageEmpty}>
          <Ionicons name="shield-checkmark-outline" size={28} color="#45C997" />
          <View style={{ flex: 1, gap: 3 }}>
            <AppText weight="600">Nothing to manage yet</AppText>
            <AppText variant="caption" tone="secondary">
              Groups you create will appear here.
            </AppText>
          </View>
        </Card>
      )}

      <SectionHeading title="Memberships" subtitle="Communities you have joined" />
      {joined.length ? (
        <View style={styles.rowList}>
          {joined.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              action="Leave"
              onOpen={() => onOpen(group)}
              onAction={() => onLeave(group)}
            />
          ))}
        </View>
      ) : (
        <AppText variant="caption" tone="secondary">
          You have not joined another community yet.
        </AppText>
      )}
    </View>
  );
}

function ProfileGroups({
  handle,
  data,
  loading,
  detail,
  onOpen,
  onCloseDetail,
  onJoin,
  onLeave,
}: {
  handle: string;
  data: { groups: FitnessGroup[] } | null | undefined;
  loading: boolean;
  detail: FitnessGroup | null;
  onOpen: (group: FitnessGroup) => void;
  onCloseDetail: () => void;
  onJoin: (group: FitnessGroup) => Promise<void>;
  onLeave: (group: FitnessGroup) => Promise<void>;
}) {
  const router = useRouter();
  const openChat = (group: FitnessGroup) => {
    onCloseDetail();
    router.push({ pathname: '/group-chat/[id]', params: { id: group.id } });
  };
  if (!loading && data === null) {
    return (
      <Screen>
        <ScreenHeader title="Groups" />
        <EmptyState
          title="Groups not available"
          body="This profile is private, or the link is wrong."
          actionTitle="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader title={`@${handle}'s groups`} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : data?.groups.length ? (
        <View style={styles.rowList}>
          {data.groups.map((group) => (
            <GroupRow key={group.id} group={group} onOpen={() => onOpen(group)} />
          ))}
        </View>
      ) : (
        <EmptyState title="No public groups" body="They have not joined any public groups yet." />
      )}
      <GroupDetailsSheet
        group={detail}
        onClose={onCloseDetail}
        onJoin={(group) => void onJoin(group)}
        onLeave={(group) => void onLeave(group)}
        onOpenChat={openChat}
      />
    </Screen>
  );
}

/** The home gym on the For-you page: its group, and where you stand with it. */
function YourGymCard({
  gym,
  joining,
  onOpen,
  onJoin,
  onManage,
}: {
  gym: MyGym;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
  onManage: () => void;
}) {
  const { colors } = useTheme();
  const { group, restriction } = gym;
  const unread = useGroupUnread(group?.id);
  const line = restriction
    ? restriction.kind === 'ban'
      ? `Removed by its members until ${untilLabel(restriction.until)}`
      : `Suspended until ${untilLabel(restriction.until)}`
    : group
      ? `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}${group.isMember ? ' · you’re in' : ''}`
      : 'Nobody in its group yet — you’d be the first';
  return (
    <Card style={styles.startCard}>
      <View style={[styles.gymIcon, { backgroundColor: `${colors.accent}1F` }]}>
        <Ionicons name="barbell-outline" size={22} color={colors.accent} />
      </View>
      <View style={styles.startCopy}>
        <View style={styles.titleBadgeRow}>
          <AppText weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {gym.gym.name}
          </AppText>
          <UnreadPill count={unread} />
        </View>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {line}
        </AppText>
      </View>
      {group?.isMember ? (
        <Button compact title="Open" variant="secondary" onPress={onOpen} />
      ) : restriction ? (
        <Button compact title="Manage" variant="secondary" onPress={onManage} />
      ) : (
        <Button compact title="Join" loading={joining} onPress={onJoin} />
      )}
    </Card>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionCopy}>
        <AppText variant="heading" weight="700">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction}>
          <AppText variant="caption" weight="600" tone="accent">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Unread messages in a group's chat, from the one list every row shares. */
function useGroupUnread(groupId?: string): number {
  const groupChats = useGroupChats();
  if (!groupId) return 0;
  return groupChats.data?.find((row) => row.group.id === groupId)?.unreadCount ?? 0;
}

function UnreadPill({ count }: { count: number }) {
  const { colors } = useTheme();
  if (!count) return null;
  return (
    <View
      accessibilityLabel={`${count} unread ${count === 1 ? 'message' : 'messages'}`}
      style={[styles.unreadPill, { backgroundColor: colors.accent }]}
    >
      <AppText variant="micro" weight="700" style={{ color: colors.onAccent }}>
        {count > 99 ? '99+' : count}
      </AppText>
    </View>
  );
}

function GroupRow({
  group,
  badge,
  action,
  onOpen,
  onAction,
}: {
  group: FitnessGroup;
  badge?: string;
  action?: string;
  onOpen: () => void;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const unread = useGroupUnread(group.id);
  return (
    <Card padded={false} style={styles.groupRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${group.name}`}
        onPress={onOpen}
        style={styles.groupMain}
      >
        <GroupIdentity group={group} size={52} />
        <View style={styles.groupCopy}>
          <View style={styles.titleBadgeRow}>
            <AppText weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
              {group.name}
            </AppText>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: `${colors.accent}18` }]}>
                <AppText variant="micro" weight="600" tone="accent">
                  {badge}
                </AppText>
              </View>
            ) : null}
            <UnreadPill count={unread} />
          </View>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {groupMeta(group)}
          </AppText>
        </View>
      </Pressable>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} ${group.name}`}
          onPress={onAction}
          style={[styles.rowAction, { backgroundColor: colors.surfaceRaised }]}
        >
          <AppText
            variant="caption"
            weight="600"
            tone={action === 'Leave' ? 'secondary' : 'accent'}
          >
            {action}
          </AppText>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
      )}
    </Card>
  );
}

function DiscoverCard({
  group,
  nearby,
  fullWidth = false,
  onOpen,
  onJoin,
}: {
  group: FitnessGroup;
  nearby: boolean;
  fullWidth?: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const { colors } = useTheme();
  const gradient = gradientFor(group);
  return (
    <Card padded={false} style={[styles.discoveryCard, fullWidth && styles.discoveryCardWide]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${group.name}`}
        onPress={onOpen}
      >
        <LinearGradient colors={gradient} style={styles.cardArt}>
          <View style={styles.cardOrb} />
          <GroupIdentity group={group} size={58} elevated />
          {nearby ? (
            <View style={styles.nearbyPill}>
              <Ionicons name="location" size={12} color="#FFFFFF" />
              <AppText variant="micro" weight="600" style={styles.whiteText}>
                NEAR YOU
              </AppText>
            </View>
          ) : null}
        </LinearGradient>
        <View style={styles.cardBody}>
          <AppText weight="700" numberOfLines={1}>
            {group.name}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {groupMeta(group)}
          </AppText>
          <AppText
            variant="caption"
            tone="secondary"
            numberOfLines={2}
            style={styles.cardDescription}
          >
            {group.description ||
              `A community for ${group.sport?.toLocaleLowerCase() || 'active people'} to connect and progress together.`}
          </AppText>
        </View>
      </Pressable>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.memberProof}>
          <Ionicons name="people-outline" size={16} color={colors.textMuted} />
          <AppText variant="micro" tone="secondary">
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </AppText>
        </View>
        <Button compact title="Join" onPress={onJoin} style={styles.joinButton} />
      </View>
    </Card>
  );
}

function DiscoveryEmpty({ onCreate }: { onCreate: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.discoveryEmpty}>
      <View style={[styles.emptyIcon, { backgroundColor: `${colors.accent}18` }]}>
        <Ionicons name="compass-outline" size={28} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText weight="600">Be the first nearby</AppText>
        <AppText variant="caption" tone="secondary">
          Public groups from your area will be recommended here.
        </AppText>
      </View>
      <Button compact title="Create" variant="secondary" onPress={onCreate} />
    </Card>
  );
}

function GroupDetailsSheet({
  group,
  onClose,
  onEdit,
  onJoin,
  onLeave,
  onSetHomeGym,
  onOpenChat,
}: {
  group: FitnessGroup | null;
  onClose: () => void;
  onEdit?: (group: FitnessGroup) => void;
  onJoin: (group: FitnessGroup) => void;
  onLeave?: (group: FitnessGroup) => void;
  /** A gym group is joined by making the gym home, not by a join button. */
  onSetHomeGym?: () => void;
  /** The group's chat, for members. */
  onOpenChat?: (group: FitnessGroup) => void;
}) {
  const isGym = group?.kind === 'gym';
  // Only members may see who else is in; the query refuses everyone else.
  const members = useGroupMembers(group?.id ?? '', Boolean(group?.isMember));
  const unread = useGroupUnread(group?.id);
  return (
    <Sheet visible={group !== null} onClose={onClose} title={group?.name}>
      {group ? (
        <>
          <View style={styles.detailLead}>
            <GroupIdentity group={group} size={72} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="caption" tone="secondary">
                {groupMeta(group)}
              </AppText>
              <View style={styles.detailTags}>
                {isGym ? <DetailTag icon="fitness-outline" label="Home gym group" /> : null}
                <DetailTag icon="earth-outline" label={group.isPublic ? 'Public' : 'Private'} />
                {group.location ? (
                  <DetailTag icon="location-outline" label={group.location} />
                ) : null}
              </View>
            </View>
          </View>
          <AppText>
            {group.description || 'This community has not added a description yet.'}
          </AppText>
          {group.isMember && onOpenChat ? (
            <Button
              title={unread ? `Group chat · ${unread} new` : 'Group chat'}
              onPress={() => onOpenChat(group)}
            />
          ) : null}
          {isGym ? (
            group.isMember ? (
              <Button title="Leave group" variant="secondary" onPress={() => onLeave?.(group)} />
            ) : (
              <Button title="Set as my home gym" onPress={() => onSetHomeGym?.()} />
            )
          ) : group.isOwner ? (
            <Button title="Edit group" onPress={() => onEdit?.(group)} />
          ) : group.isMember ? (
            <Button title="Leave group" variant="secondary" onPress={() => onLeave?.(group)} />
          ) : (
            <Button title="Join group" onPress={() => onJoin(group)} />
          )}
          {group.isMember ? (
            <MembersSection
              group={group}
              data={members.data}
              loading={members.isLoading}
              onClose={onClose}
            />
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

/**
 * Who is in the group. Public profiles only — everyone is counted. In a gym
 * group each row carries the quiet vote that keeps the group in shape; the
 * numbers come from convex/lib/gymVotes.ts so the copy never drifts.
 */
function MembersSection({
  group,
  data,
  loading,
  onClose,
}: {
  group: FitnessGroup;
  data: { total: number; listed: number; members: GroupMember[] } | undefined;
  loading: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const vote = useVoteRemove();
  const retract = useRetractVote();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isGym = group.kind === 'gym';

  async function castVote(member: GroupMember) {
    setError(null);
    setConfirming(null);
    try {
      await vote.mutateAsync({ id: group.id, targetUserId: member.id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record your vote.');
    }
  }

  async function takeBack(member: GroupMember) {
    setError(null);
    try {
      await retract.mutateAsync({ id: group.id, targetUserId: member.id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not take your vote back.');
    }
  }

  return (
    <View style={styles.members}>
      <View style={styles.membersHead}>
        <AppText variant="heading" weight="700">
          Members
        </AppText>
        {data ? (
          <AppText variant="caption" tone="secondary">
            {data.total} {data.total === 1 ? 'member' : 'members'} · {data.listed} public
          </AppText>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : data?.members.length ? (
        data.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            confirming={confirming === member.id}
            busy={vote.isPending || retract.isPending}
            onOpen={() => {
              if (!member.handle) return;
              onClose();
              router.push({ pathname: '/u/[handle]', params: { handle: member.handle } });
            }}
            onVote={() => (member.myVote ? void takeBack(member) : setConfirming(member.id))}
            onConfirm={() => void castVote(member)}
            onCancel={() => setConfirming(null)}
          />
        ))
      ) : (
        <AppText variant="caption" tone="muted">
          Nobody with a public profile yet.
        </AppText>
      )}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      {isGym ? (
        <AppText variant="micro" tone="muted">
          This group has no owner. {GYM_VOTE_RULES.SUSPEND_VOTES} members voting in a week suspend
          someone for {GYM_VOTE_RULES.SUSPENSION_DAYS} days; {GYM_VOTE_RULES.BAN_VOTES} remove them
          for {GYM_VOTE_RULES.BAN_DAYS}. Votes are anonymous.
        </AppText>
      ) : null}
    </View>
  );
}

function MemberRow({
  member,
  confirming,
  busy,
  onOpen,
  onVote,
  onConfirm,
  onCancel,
}: {
  member: GroupMember;
  confirming: boolean;
  busy: boolean;
  onOpen: () => void;
  onVote: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const target = nextThreshold(member.status);
  const tally = member.votes > 0 ? ` · ${member.votes} of ${target}` : '';
  const voteLabel = member.myVote ? `Voted${tally}` : `Vote to remove${tally}`;
  return (
    <View style={[styles.memberRow, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${member.displayName}${member.isYou ? ', you' : ''}`}
        onPress={onOpen}
        disabled={!member.handle}
        style={styles.memberIdentity}
      >
        <ChatAvatar person={member} size={40} />
        <View style={styles.memberCopy}>
          <AppText weight="600" numberOfLines={1}>
            {member.displayName}
            {member.isYou ? ' (you)' : ''}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {member.status === 'suspended'
              ? 'Suspended'
              : [member.handle ? `@${member.handle}` : null, member.primarySport]
                  .filter(Boolean)
                  .join(' · ')}
          </AppText>
        </View>
      </Pressable>
      {member.canVote ? (
        confirming ? (
          <View style={styles.voteConfirm}>
            <Button compact title="Confirm" variant="danger" onPress={onConfirm} disabled={busy} />
            <Button compact title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              member.myVote
                ? `Take back your vote to remove ${member.displayName}`
                : `Vote to remove ${member.displayName}`
            }
            onPress={onVote}
            disabled={busy}
            hitSlop={6}
            style={styles.voteAction}
          >
            <AppText variant="micro" tone={member.myVote ? 'secondary' : 'muted'} weight="600">
              {voteLabel}
            </AppText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function DetailTag({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailTag, { backgroundColor: colors.surfaceRaised }]}>
      <Ionicons name={icon} size={13} color={colors.textSecondary} />
      <AppText variant="micro" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

function GroupEditorSheet({
  visible,
  group,
  defaultLocation,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  group?: FitnessGroup | null;
  defaultLocation?: string;
  onClose: () => void;
  onSave: (input: NewGroup) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [sport, setSport] = useState(group?.sport ?? '');
  const [location, setLocation] = useState(group?.location ?? defaultLocation ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [isPublic, setIsPublic] = useState(group?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet visible={visible} onClose={onClose} title={group ? 'Manage group' : 'New group'}>
      <TextField
        label="Group name"
        value={name}
        onChangeText={setName}
        placeholder="Saturday stride club"
        maxLength={60}
        required
      />
      <View style={styles.editorPair}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Activity"
            value={sport}
            onChangeText={setSport}
            placeholder="Running"
            maxLength={40}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Austin, TX"
            maxLength={60}
          />
        </View>
      </View>
      <TextField
        label="About"
        value={description}
        onChangeText={setDescription}
        placeholder="What brings this community together?"
        multiline
        maxLength={280}
        style={styles.aboutField}
      />
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Public group"
        accessibilityState={{ checked: isPublic }}
        onPress={() => setIsPublic((value) => !value)}
        style={styles.privacyRow}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="600">{isPublic ? 'Public community' : 'Private community'}</AppText>
          <AppText variant="caption" tone="secondary">
            {isPublic
              ? 'People can discover and join this group.'
              : 'Only current members can see this group.'}
          </AppText>
        </View>
        <Ionicons name={isPublic ? 'earth' : 'lock-closed'} size={22} color="#45C997" />
      </Pressable>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button
        title={group ? 'Save changes' : 'Create group'}
        loading={saving}
        disabled={!name.trim()}
        onPress={async () => {
          setSaving(true);
          setError(null);
          try {
            await onSave({
              name: name.trim(),
              sport: sport.trim() || undefined,
              location: location.trim() || undefined,
              description: description.trim() || undefined,
              isPublic,
            });
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not save this group.');
          } finally {
            setSaving(false);
          }
        }}
      />
      {group && onDelete ? (
        confirmDelete ? (
          <View style={styles.deleteConfirm}>
            <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
              Delete this group for every member? This cannot be undone.
            </AppText>
            <Button compact title="Yes, delete" variant="danger" onPress={() => void onDelete()} />
            <Button
              compact
              title="Cancel"
              variant="ghost"
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        ) : (
          <Button title="Delete group" variant="ghost" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
    </Sheet>
  );
}

function isNearby(groupLocation?: string, viewerLocation?: string) {
  if (!groupLocation || !viewerLocation) return false;
  const first = (value: string) =>
    value
      .toLocaleLowerCase()
      .split(',')[0]
      ?.replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return first(groupLocation) === first(viewerLocation);
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: spacing.xxl },
  headerInset: { paddingHorizontal: spacing.lg },
  headerAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    minHeight: 132,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(42, 219, 160, 0.16)',
    right: -58,
    top: -92,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroCopy: { flex: 1, gap: spacing.xs },
  heroTitle: { color: '#FFFFFF' },
  heroBody: { color: 'rgba(255,255,255,0.72)' },
  heroStat: { alignItems: 'center', gap: 1 },
  pageTabs: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  pageTabLine: {
    height: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginHorizontal: spacing.sm,
  },
  error: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  loading: { paddingVertical: 64, alignItems: 'center', gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.lg },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  sectionCopy: { flex: 1, gap: 2 },
  rowList: { gap: spacing.sm },
  startCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  startCopy: { flex: 1, gap: spacing.xs },
  gymIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  members: { gap: spacing.sm, marginTop: spacing.sm },
  membersHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberCopy: { flex: 1, gap: 2 },
  voteAction: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs },
  voteConfirm: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardRail: { gap: spacing.md, paddingRight: spacing.lg },
  discoveryGrid: { gap: spacing.md },
  groupRow: {
    minHeight: 74,
    padding: spacing.sm,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupCopy: { flex: 1, gap: 3 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAction: {
    minWidth: 54,
    minHeight: 34,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoveryCard: { width: 258, overflow: 'hidden' },
  discoveryCardWide: { width: '100%' },
  cardArt: {
    minHeight: 104,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  cardOrb: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.09)',
    right: -25,
    bottom: -72,
  },
  nearbyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  whiteText: { color: '#FFFFFF' },
  cardBody: { padding: spacing.md, gap: 3 },
  cardDescription: { minHeight: 36, marginTop: 2 },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memberProof: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  joinButton: { minWidth: 62, borderRadius: radius.full },
  discoveryEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { ...type.body, flex: 1, minHeight: touchTarget },
  manageEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailLead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  editorPair: { flexDirection: 'row', gap: spacing.sm },
  aboutField: { minHeight: 92, textAlignVertical: 'top', paddingTop: spacing.sm },
  privacyRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteConfirm: { gap: spacing.sm },
});
