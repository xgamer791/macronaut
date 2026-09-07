import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  Sheet,
  TextField,
} from '@/ui/components';
import type { FitnessGroup } from '@/repositories/groupRepo';
import { useAuth } from '@/state/AuthProvider';
import {
  useCreateGroup,
  useDeleteGroup,
  useJoinGroup,
  useLeaveGroup,
  useMyGroups,
  usePublicGroups,
} from '@/state/queries';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';

/**
 * Groups on a profile. Your own page lists every group you belong to and
 * lets you start one. Someone else's page lists the public groups they are
 * in, and you can join those.
 */
export default function GroupsScreen() {
  return (
    <ThemeProvider initialMode="dark">
      <SlideScreen from="left">
        <GroupsList />
      </SlideScreen>
    </ThemeProvider>
  );
}

function GroupsList() {
  const { handle } = useLocalSearchParams<{ handle?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const own = useMyGroups();
  const other = usePublicGroups(handle ?? '');
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();

  const [createOpen, setCreateOpen] = useState(false);
  const [open, setOpen] = useState<FitnessGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwn = !handle;
  const list = handle ? other.data : { isOwner: true, groups: own.data ?? [] };
  const loading = handle ? other.isLoading : own.isLoading;
  const groups = list?.groups ?? [];
  const canCreate = isOwn || list?.isOwner === true;

  if (handle && !other.isLoading && other.data === null) {
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
      <ScreenHeader
        title="Groups"
        right={
          canCreate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a group"
              onPress={() => setCreateOpen(true)}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Ionicons name="add" size={28} color={colors.textPrimary} />
            </Pressable>
          ) : null
        }
      />

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          title={canCreate ? 'No groups yet' : 'No public groups'}
          body={
            canCreate
              ? 'Start a fitness group and it will show here. Public groups are visible on your profile.'
              : 'They have not joined any public groups yet.'
          }
          actionTitle={canCreate ? 'Create a group' : undefined}
          onAction={canCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {groups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={group.name}
              onPress={() => setOpen(group)}
            >
              <Card style={styles.card}>
                <View style={styles.mark}>
                  <Ionicons name="people" size={22} color={colors.textPrimary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {group.name}
                  </AppText>
                  <AppText variant="caption" tone="secondary" numberOfLines={1}>
                    {[
                      group.sport,
                      `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`,
                      group.isPublic ? 'Public' : 'Private',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <CreateGroupSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          await createGroup.mutateAsync(input);
          setCreateOpen(false);
        }}
      />

      <Sheet visible={open !== null} onClose={() => setOpen(null)} title={open?.name}>
        {open ? (
          <>
            <AppText variant="caption" tone="secondary">
              {[
                open.sport,
                `${open.memberCount} ${open.memberCount === 1 ? 'member' : 'members'}`,
                open.isPublic ? 'Public' : 'Private',
                `@${open.handle}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
            {open.description ? <AppText variant="body">{open.description}</AppText> : null}
            {open.isOwner ? (
              <Button
                title="Delete group"
                variant="danger"
                onPress={() => {
                  void deleteGroup.mutateAsync(open.id);
                  setOpen(null);
                }}
              />
            ) : open.isMember ? (
              <Button
                title="Leave group"
                variant="secondary"
                onPress={() => {
                  void leaveGroup.mutateAsync(open.id);
                  setOpen(null);
                }}
              />
            ) : (
              <Button
                title={signedIn ? 'Join group' : 'Sign in to join'}
                onPress={() => {
                  if (!signedIn) {
                    setOpen(null);
                    router.push('/login');
                    return;
                  }
                  void joinGroup
                    .mutateAsync(open.id)
                    .then((next) => setOpen(next))
                    .catch((e) => setError(e instanceof Error ? e.message : 'Could not join.'));
                }}
              />
            )}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function CreateGroupSheet({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    sport?: string;
    description?: string;
    isPublic: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setSport('');
    setDescription('');
    setIsPublic(true);
    setError(null);
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New group"
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Morning miles"
        maxLength={60}
      />
      <TextField
        label="Sport (optional)"
        value={sport}
        onChangeText={setSport}
        placeholder="Running"
        maxLength={40}
      />
      <TextField
        label="About (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Easy long runs on Saturday."
        multiline
        maxLength={280}
        style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />
      <Button
        title={isPublic ? 'Public group' : 'Private group'}
        variant="secondary"
        onPress={() => setIsPublic((v) => !v)}
      />
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button
        title="Create group"
        loading={saving}
        disabled={!name.trim()}
        onPress={async () => {
          setSaving(true);
          setError(null);
          try {
            await onCreate({
              name,
              sport: sport.trim() || undefined,
              description: description.trim() || undefined,
              isPublic,
            });
            reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create that group.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
  },
  mark: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
