import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ChatPerson } from '@/repositories/chatRepo';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { ChatAvatar } from './ChatAvatar';

export interface ChatPersonRowProps {
  person: ChatPerson;
  busy?: boolean;
  disabled?: boolean;
  onProfile: () => void;
  onAddFriend: () => void;
  onAcceptFriend: () => void;
  onMessage: () => void;
}

/** A database user result with the only action their friendship permits. */
export function ChatPersonRow({
  person,
  busy = false,
  disabled = false,
  onProfile,
  onAddFriend,
  onAcceptFriend,
  onMessage,
}: ChatPersonRowProps) {
  const { colors } = useTheme();
  const action =
    person.friendship === 'friends'
      ? { title: 'Message', onPress: onMessage, variant: 'primary' as const, disabled: false }
      : person.friendship === 'incoming'
        ? { title: 'Accept', onPress: onAcceptFriend, variant: 'primary' as const, disabled: false }
        : person.friendship === 'outgoing'
          ? {
              title: 'Requested',
              onPress: onAddFriend,
              variant: 'secondary' as const,
              disabled: true,
            }
          : {
              title: 'Add friend',
              onPress: onAddFriend,
              variant: 'secondary' as const,
              disabled: false,
            };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${person.displayName}'s profile`}
        onPress={onProfile}
        style={({ pressed }) => [styles.identity, pressed && { opacity: 0.65 }]}
      >
        <ChatAvatar person={person} size={48} />
        <View style={styles.copy}>
          <AppText weight="600" numberOfLines={1}>
            {person.displayName}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            @{person.handle}
          </AppText>
        </View>
      </Pressable>
      <Button
        compact
        title={action.title}
        variant={action.variant}
        disabled={disabled || action.disabled}
        loading={busy}
        onPress={action.onPress}
        style={[styles.action, { borderColor: colors.borderStrong }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  action: { minWidth: 92 },
});
