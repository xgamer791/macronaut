import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useRepos } from '@/state/AppProvider';
import { keys, useSetting } from '@/state/queries';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { PUSH_WANTED_SETTING, isPushNotificationsLive } from '@/utils/pushNotificationStatus';
import { AppText } from './AppText';

/**
 * Push opt-in, at the top of Notifications.
 *
 * Written as a control rather than a promotion: one row in the app's own list
 * language, so it reads as the setting it is and never has to be dismissed.
 * The status line names what would actually reach someone — the two events
 * that already exist — and, once the switch is on, the one caveat that has to
 * be said: push cannot work on a website, since there is no app to hold a
 * token, so this records what someone wants rather than claiming to have
 * turned anything on. The native iOS build reads the stored answer
 * (docs/native-ios.md).
 */
export function NotificationOptIn() {
  const { colors } = useTheme();
  const { settings } = useRepos();
  const qc = useQueryClient();
  const wanted = useSetting<boolean>(PUSH_WANTED_SETTING, false);

  // Once push is real and granted there is nothing to ask for.
  if (isPushNotificationsLive()) return null;

  const on = wanted.data === true;

  async function choose(next: boolean) {
    await settings.set(PUSH_WANTED_SETTING, next);
    qc.invalidateQueries({ queryKey: keys.setting(PUSH_WANTED_SETTING) });
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.icon}>
        <Ionicons
          name={on ? 'notifications' : 'notifications-off-outline'}
          size={22}
          color={on ? colors.accent : colors.textMuted}
        />
      </View>

      <View style={styles.copy}>
        <AppText variant="body" weight="600">
          Push notifications
        </AppText>
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          {on ? 'Messages and friend requests. Starts on iOS.' : 'Messages and friend requests.'}
        </AppText>
      </View>

      <Switch
        accessibilityLabel="Push notifications"
        value={on}
        onValueChange={(next) => void choose(next)}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={colors.onAccent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
});
