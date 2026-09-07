import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GroupMessage } from '@/repositories/groupChatRepo';
import type { FitnessGroup } from '@/repositories/groupRepo';
import { pickAttachment, takePhotoAttachment } from '@/services/media/pickAttachment';
import type { PickedAttachment } from '@/services/media/pickedAttachment';
import { useAuth } from '@/state/AuthProvider';
import {
  useGroupChatThread,
  useJoinGroup,
  useJoinGymGroup,
  useMarkGroupChatRead,
  useMyGym,
  useRemoveGroupMessage,
  useSendGroupMessage,
} from '@/state/queries';
import { MessageComposer } from '@/ui/chat/MessageComposer';
import { MessageList } from '@/ui/chat/MessageList';
import { AppText, Button, EmptyState, GroupIdentity, Sheet, groupMeta } from '@/ui/components';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';

/** A group's one conversation: the same thread and composer as a direct
 * chat, with the group on the door and every sender named. Members read
 * and write; anyone else sees the group and how to join it. */
export default function GroupChatScreen() {
  return (
    <SlideScreen from="left">
      <GroupConversation />
    </SlideScreen>
  );
}

function GroupConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  const router = useRouter();
  const onBack = useSlideBack();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signedIn } = useAuth();
  const thread = useGroupChatThread(groupId);
  const myGym = useMyGym();
  const send = useSendGroupMessage();
  const join = useJoinGroup();
  const joinGymGroup = useJoinGymGroup();
  const remove = useRemoveGroupMessage();
  const { mutate: markRead } = useMarkGroupChatRead();
  const lastMarkedRead = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GroupMessage | null>(null);

  // Opening the thread reads it. Keyed by the newest message so a thread
  // that keeps polling marks itself read once per new message, not per poll.
  const unreadCount = thread.data?.unreadCount ?? 0;
  const lastMessageAt = thread.data?.lastMessageAt ?? null;
  useEffect(() => {
    const marker = unreadCount ? `${groupId}:${lastMessageAt ?? ''}` : null;
    if (!marker || lastMarkedRead.current === marker) return;
    lastMarkedRead.current = marker;
    markRead(groupId);
  }, [groupId, lastMessageAt, markRead, unreadCount]);

  async function chooseAttachment(source: 'library' | 'camera') {
    setError(null);
    try {
      const picked = source === 'camera' ? await takePhotoAttachment() : await pickAttachment();
      if (picked) setAttachment(picked);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : source === 'camera'
            ? 'Could not open your camera.'
            : 'Could not open your library.',
      );
    }
  }

  async function openShareProvider(name: string, url: string) {
    setError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setError(`Could not open ${name}.`);
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if ((!body && !attachment) || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync({ id: groupId, body, attachment: attachment ?? undefined });
      setDraft('');
      setAttachment(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that message.');
    }
  }

  /** A gym group is joined through the home gym; any other by asking. */
  async function joinGroup(group: FitnessGroup) {
    setError(null);
    try {
      if (group.kind === 'gym') await joinGymGroup.mutateAsync();
      else await join.mutateAsync(group.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this group.');
    }
  }

  async function deleteMessage(message: GroupMessage) {
    setError(null);
    try {
      await remove.mutateAsync({ id: groupId, messageId: message.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that message.');
    } finally {
      setPendingDelete(null);
    }
  }

  if (!signedIn) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState
          title="Sign in to chat"
          body="Group chats are saved securely with your Macronaut account."
          actionTitle="Sign in"
          onAction={() => router.replace('/login')}
        />
      </View>
    );
  }

  if (thread.isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const data = thread.data;
  if (!data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState
          title="Chat not available"
          body="This group may have been removed, or its chat is for members only."
          actionTitle="Back to groups"
          onAction={() => router.replace('/groups')}
        />
      </View>
    );
  }

  const { group } = data;
  // A gym group whose gym is already yours only needs the seat, not the gym.
  const gymIsMine = group.kind === 'gym' && myGym.data?.group?.id === group.id;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.chrome,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={8}
          style={styles.headerHit}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.identity} accessibilityLabel={`${group.name} group chat`}>
          <GroupIdentity group={group} size={38} />
          <View style={styles.identityCopy}>
            <AppText weight="700" numberOfLines={1}>
              {group.name}
            </AppText>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              {groupMeta(group)}
            </AppText>
          </View>
        </View>
        <View style={styles.headerHit} />
      </View>

      <MessageList
        messages={data.messages}
        me={data.me}
        showSenderNames
        onLongPressMessage={(message) => {
          if (message.canDelete) setPendingDelete(message);
        }}
        empty={
          <>
            <GroupIdentity group={group} size={72} />
            <AppText variant="heading" weight="700" align="center">
              {group.name}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              {group.isMember
                ? 'Say hello to everyone in the group.'
                : 'Members can read and send messages here.'}
            </AppText>
          </>
        }
      />

      {group.isMember ? (
        <MessageComposer
          draft={draft}
          onDraft={setDraft}
          attachment={attachment}
          onAttach={() => void chooseAttachment('library')}
          onTakePhoto={() => void chooseAttachment('camera')}
          onOpenGiphy={() => void openShareProvider('GIPHY', 'https://giphy.com/search')}
          onOpenMaps={() => void openShareProvider('Google Maps', 'https://maps.google.com')}
          onRemoveAttachment={() => setAttachment(null)}
          onSend={() => void sendMessage()}
          sending={send.isPending}
          error={error}
          accessibilityLabel={`Message ${group.name}`}
        />
      ) : (
        <MemberGate
          group={group}
          gymIsMine={gymIsMine}
          busy={join.isPending || joinGymGroup.isPending}
          bottom={Math.max(insets.bottom, spacing.sm)}
          error={error}
          onJoin={() => void joinGroup(group)}
          onSetHomeGym={() => router.push('/home-gym')}
        />
      )}

      <Sheet
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete message?"
      >
        <View style={styles.confirm}>
          <AppText tone="secondary">This removes it for everyone in the group.</AppText>
          <Button
            title="Delete"
            variant="danger"
            loading={remove.isPending}
            onPress={() => {
              if (pendingDelete) void deleteMessage(pendingDelete);
            }}
          />
          <Button title="Cancel" variant="secondary" onPress={() => setPendingDelete(null)} />
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/** The bottom bar for someone outside the group: what the chat is, and the
 * one way in. A gym group is joined by making the gym home; once it is,
 * only the seat is missing. A private group offers nothing. */
function MemberGate({
  group,
  gymIsMine,
  busy,
  bottom,
  error,
  onJoin,
  onSetHomeGym,
}: {
  group: FitnessGroup;
  gymIsMine: boolean;
  busy: boolean;
  bottom: number;
  error: string | null;
  onJoin: () => void;
  onSetHomeGym: () => void;
}) {
  const { colors } = useTheme();
  const isGym = group.kind === 'gym';
  const canJoin = isGym ? gymIsMine : group.isPublic;
  const line = isGym
    ? gymIsMine
      ? `Join ${group.name}'s group to read and send messages.`
      : `Make ${group.name} your home gym to join its group.`
    : group.isPublic
      ? `Join ${group.name} to read and send messages.`
      : 'This group is private.';
  return (
    <View
      style={[
        styles.gateWrap,
        {
          backgroundColor: colors.chrome,
          borderTopColor: colors.border,
          paddingBottom: bottom,
        },
      ]}
    >
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.gate}>
        <View style={{ flex: 1 }}>
          <AppText weight="700">Members can chat</AppText>
          <AppText variant="caption" tone="muted">
            {line}
          </AppText>
        </View>
        {canJoin ? (
          <Button compact title="Join group" loading={busy} onPress={onJoin} />
        ) : isGym ? (
          <Button compact title="Set as my home gym" onPress={onSetHomeGym} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  error: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  gateWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  gate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  confirm: {
    gap: spacing.md,
  },
});
