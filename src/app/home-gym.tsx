import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MyGym } from '@/repositories/gymRepo';
import { useAuth } from '@/state/AuthProvider';
import { useClearGym, useJoinGymGroup, useLeaveGroup, useMyGym } from '@/state/queries';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import {
  AppText,
  Button,
  HomeGymPicker,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/ui/components';
import { untilLabel } from '../../convex/lib/gymVotes';

export default function HomeGymRoute() {
  const { loading, signedIn } = useAuth();
  if (loading) return null;
  if (!signedIn) return <Redirect href="/welcome" />;
  return (
    <SlideScreen from="right">
      <HomeGymScreen />
    </SlideScreen>
  );
}

/** Your home gym: what it is, where you stand with its group, and the same
 * picker onboarding used, for changing it. */
function HomeGymScreen() {
  const mine = useMyGym();
  const current = mine.data ?? null;

  return (
    <Screen>
      <ScreenHeader title="Home gym" />
      {mine.isLoading ? null : current ? (
        <CurrentGym current={current} />
      ) : (
        <AppText variant="caption" tone="secondary">
          Set your home gym and you’ll be connected with everyone on Macronaut who trains there.
        </AppText>
      )}
      <SectionHeader title={current ? 'Change gym' : 'Find your gym'} />
      <HomeGymPicker confirmLabel={current ? 'Save home gym' : 'Set home gym'} />
    </Screen>
  );
}

function CurrentGym({ current }: { current: MyGym }) {
  const { colors } = useTheme();
  const router = useRouter();
  const join = useJoinGymGroup();
  const leave = useLeaveGroup();
  const clear = useClearGym();
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { gym, group, restriction } = current;
  const busy = join.isPending || leave.isPending || clear.isPending;

  async function run(task: () => Promise<unknown>) {
    setError(null);
    try {
      await task();
      void Haptics.selectionAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  const standing = restriction
    ? restriction.kind === 'ban'
      ? `Removed from the group by its members until ${untilLabel(restriction.until)}.`
      : `Suspended from the group by its members until ${untilLabel(restriction.until)}.`
    : group?.isMember
      ? `You’re in the group with ${others(group.memberCount)}.`
      : group
        ? `${group.memberCount} ${group.memberCount === 1 ? 'person trains' : 'people train'} here. You haven’t joined the group.`
        : 'Nobody has joined this gym’s group yet — you’d be the first.';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.titleRow}>
        <View style={[styles.icon, { backgroundColor: `${colors.accent}1F` }]}>
          <Ionicons name="barbell-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.grow}>
          <AppText variant="heading" weight="700" numberOfLines={1}>
            {gym.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {gym.address}
          </AppText>
        </View>
      </View>

      <AppText variant="caption" tone="secondary">
        {standing}
      </AppText>

      <View style={styles.actions}>
        {group?.isMember ? (
          <>
            <Button
              title="Open group"
              compact
              onPress={() => router.push('/groups')}
              disabled={busy}
            />
            <Button
              title="Leave group"
              variant="secondary"
              compact
              loading={leave.isPending}
              disabled={busy}
              onPress={() => void run(() => leave.mutateAsync(group.id))}
            />
          </>
        ) : restriction ? null : (
          <Button
            title="Join the group"
            compact
            loading={join.isPending}
            disabled={busy}
            onPress={() => void run(() => join.mutateAsync())}
          />
        )}
        {confirmClear ? (
          <>
            <Button
              title="Remove"
              variant="danger"
              compact
              loading={clear.isPending}
              disabled={busy}
              onPress={() => void run(() => clear.mutateAsync())}
            />
            <Button
              title="Keep"
              variant="ghost"
              compact
              disabled={busy}
              onPress={() => setConfirmClear(false)}
            />
          </>
        ) : (
          <Button
            title="Remove home gym"
            variant="ghost"
            compact
            disabled={busy}
            onPress={() => setConfirmClear(true)}
          />
        )}
      </View>

      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function others(memberCount: number): string {
  const rest = Math.max(0, memberCount - 1);
  if (rest === 0) return 'nobody else yet';
  return `${rest} ${rest === 1 ? 'other' : 'others'}`;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
