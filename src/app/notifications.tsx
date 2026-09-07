import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { AppNotification } from '@/repositories/notificationRepo';
import { useAuth } from '@/state/AuthProvider';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useSetProfileFollow,
} from '@/state/queries';
import {
  AppText,
  Button,
  ChatAvatar,
  EmptyState,
  ErrorState,
  Screen,
  ScreenHeader,
} from '@/ui/components';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

export default function NotificationsRoute() {
  return (
    <SlideScreen from="right">
      <NotificationsScreen />
    </SlideScreen>
  );
}

function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const feed = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const setFriend = useSetProfileFollow();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const unread = feed.data?.items.filter((item) => !item.read) ?? [];
  const earlier = feed.data?.items.filter((item) => item.read) ?? [];

  function open(item: AppNotification) {
    if (!item.read) markRead.mutate(item.id);
    if (item.kind === 'chat_message' && item.chatId) {
      router.push({ pathname: '/chat/[id]', params: { id: item.chatId } });
    } else if (item.actor.handle) {
      router.push(`/u/${item.actor.handle}`);
    }
    // A friend request needs no page to open: its Accept is on the row, which
    // is the only thing that works when their profile page is private.
  }

  async function accept(item: AppNotification) {
    if (!item.read) markRead.mutate(item.id);
    setAcceptError(null);
    setAccepting(item.actor.id);
    try {
      await setFriend.mutateAsync({ userId: item.actor.id, follow: true });
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : 'Could not accept that request.');
    } finally {
      setAccepting(null);
    }
  }

  if (!signedIn) {
    return (
      <Screen padded={false} scroll={false}>
        <View style={styles.header}>
          <ScreenHeader title="Notifications" />
        </View>
        <EmptyState
          title="Sign in to see notifications"
          body="Friend requests and new messages will appear here."
          actionTitle="Sign in"
          onAction={() => router.replace('/login')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ScreenHeader
          title="Notifications"
          right={
            feed.data?.unreadCount ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
                disabled={markAllRead.isPending}
                onPress={() => markAllRead.mutate()}
                hitSlop={8}
                style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}
              >
                {markAllRead.isPending ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="checkmark-done" size={23} color={colors.accent} />
                )}
              </Pressable>
            ) : null
          }
        />
      </View>

      {feed.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : feed.isError ? (
        <ErrorState
          message="Notifications could not be loaded."
          onRetry={() => void feed.refetch()}
        />
      ) : !feed.data?.items.length ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceRaised }]}>
            <Ionicons name="notifications-outline" size={30} color={colors.accent} />
          </View>
          <EmptyState
            title="You're all caught up"
            body="Friend requests and chat messages will show up here."
          />
        </View>
      ) : (
        <>
          <View style={[styles.summary, { borderBottomColor: colors.border }]}>
            <View style={[styles.summaryDot, { backgroundColor: colors.accent }]} />
            <AppText variant="caption" tone="secondary" weight="600">
              {feed.data.unreadCount
                ? `${feed.data.unreadCount} new ${feed.data.unreadCount === 1 ? 'update' : 'updates'}`
                : 'All caught up'}
            </AppText>
          </View>
          {acceptError ? (
            <AppText variant="caption" tone="danger" style={styles.acceptError}>
              {acceptError}
            </AppText>
          ) : null}
          <NotificationSection
            label="NEW"
            items={unread}
            onOpen={open}
            onAccept={accept}
            accepting={accepting}
          />
          <NotificationSection
            label="EARLIER"
            items={earlier}
            onOpen={open}
            onAccept={accept}
            accepting={accepting}
          />
        </>
      )}
    </Screen>
  );
}

function NotificationSection({
  label,
  items,
  onOpen,
  onAccept,
  accepting,
}: {
  label: string;
  items: AppNotification[];
  onOpen: (item: AppNotification) => void;
  onAccept: (item: AppNotification) => void;
  accepting: string | null;
}) {
  if (!items.length) return null;
  return (
    <View>
      <AppText variant="micro" tone="muted" weight="700" style={styles.sectionLabel}>
        {label}
      </AppText>
      {items.map((item) => (
        <NotificationRow
          key={item.id}
          item={item}
          onPress={() => onOpen(item)}
          onAccept={() => onAccept(item)}
          busy={accepting === item.actor.id}
        />
      ))}
    </View>
  );
}

function NotificationRow({
  item,
  onPress,
  onAccept,
  busy,
}: {
  item: AppNotification;
  onPress: () => void;
  onAccept: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const isMessage = item.kind === 'chat_message';
  // Their page may be private, so the request is answered here or nowhere.
  const canAccept = item.kind === 'friend_request' && item.actor.friendship === 'incoming';
  const accepted = !isMessage && item.actor.friendship === 'friends';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: item.read ? colors.background : `${colors.accent}0D` },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatarWrap}>
        <ChatAvatar person={item.actor} size={50} />
        <View style={[styles.kindBadge, { backgroundColor: colors.accent }]}>
          <Ionicons
            name={isMessage ? 'chatbubble' : accepted ? 'checkmark' : 'person-add'}
            size={12}
            color={colors.onAccent}
          />
        </View>
      </View>
      <View style={[styles.copy, { borderBottomColor: colors.border }]}>
        <View style={styles.topline}>
          <AppText weight={item.read ? '600' : '700'} numberOfLines={1} style={styles.title}>
            {item.title}
          </AppText>
          <AppText variant="micro" tone="muted">
            {relativeTime(item.createdAt)}
          </AppText>
        </View>
        <AppText variant="caption" tone={item.read ? 'muted' : 'secondary'} numberOfLines={2}>
          {item.body}
        </AppText>
        {canAccept ? (
          <Button compact title="Accept" loading={busy} onPress={onAccept} style={styles.accept} />
        ) : (
          <AppText variant="micro" tone="accent" weight="700" style={styles.action}>
            {isMessage ? 'OPEN CHAT' : accepted ? 'FRIENDS' : 'VIEW PROFILE'}
          </AppText>
        )}
      </View>
      {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return 'now';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
  if (elapsed < 7 * day) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  markAll: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -spacing.sm,
  },
  summary: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    letterSpacing: 0.8,
  },
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    position: 'relative',
  },
  avatarWrap: {
    width: 50,
    height: 50,
    position: 'relative',
  },
  kindBadge: {
    position: 'absolute',
    right: -3,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xxl,
  },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  action: {
    marginTop: 2,
    letterSpacing: 0.4,
  },
  accept: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minWidth: 104,
  },
  acceptError: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  unreadDot: {
    position: 'absolute',
    right: spacing.lg,
    top: 44,
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  pressed: {
    opacity: 0.68,
  },
});
