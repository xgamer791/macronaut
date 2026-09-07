import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { ChatAttachment, ChatMessage, ChatPerson } from './chatRepo';
import type { ConvexCaller } from './convexCall';
import type { FitnessGroup } from './groupRepo';

/** A message in a group's chat: a direct message plus who sent it, since a
 * group has more than one "other" person. */
export interface GroupMessage extends ChatMessage {
  sender: ChatPerson;
  /** Your own, or any message when you own the group. */
  canDelete: boolean;
}

export interface GroupChatThread {
  group: FitnessGroup;
  me: ChatPerson | null;
  messages: GroupMessage[];
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface GroupChatSummary {
  group: FitnessGroup;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    isMine: boolean;
    senderName: string;
    mediaKind?: 'image' | 'video';
  } | null;
  unreadCount: number;
  lastMessageAt: string;
}

export interface GroupChatRepo {
  /** Group chats you are in that have had a message, newest first. */
  list(): Promise<GroupChatSummary[]>;
  /** Null unless you hold a seat in the group. */
  thread(id: string): Promise<GroupChatThread | null>;
  send(id: string, body: string, attachment?: ChatAttachment): Promise<GroupMessage>;
  markRead(id: string): Promise<void>;
  remove(messageId: string): Promise<void>;
}

const groupId = (id: string) => id as Id<'fitnessGroups'>;
const messageId = (id: string) => id as Id<'groupMessages'>;
const fileId = (id: string) => id as Id<'_storage'>;

export function createGroupChatRepo(convex: ConvexCaller): GroupChatRepo {
  return {
    list: () => convex.query(api.groupChats.list, {}),
    thread: (id) => convex.query(api.groupChats.thread, { id: groupId(id) }),
    send: (id, body, attachment) =>
      convex.mutation(api.groupChats.send, {
        id: groupId(id),
        body,
        ...(attachment
          ? {
              mediaId: fileId(attachment.mediaId),
              mediaKind: attachment.kind,
              ...(attachment.width ? { mediaWidth: attachment.width } : {}),
              ...(attachment.height ? { mediaHeight: attachment.height } : {}),
            }
          : {}),
      }),
    async markRead(id) {
      await convex.mutation(api.groupChats.markRead, { id: groupId(id) });
    },
    async remove(id) {
      await convex.mutation(api.groupChats.remove, { messageId: messageId(id) });
    },
  };
}
