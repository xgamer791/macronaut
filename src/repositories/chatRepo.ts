import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { ConvexCaller } from './convexCall';

export interface ChatIdentity {
  /** The account itself — what every friend and chat action addresses. */
  id: string;
  /** Null until the account has claimed a profile; the name still shows. */
  handle: string | null;
  displayName: string;
  avatarUrl?: string;
}

export interface ChatPerson extends ChatIdentity {
  /** Mutual follows are friends; one-way follows are pending requests. */
  friendship: 'none' | 'outgoing' | 'incoming' | 'friends';
}

/** One picture or clip attached to a message. `url` is a signed storage URL
 * resolved per read, so it is never persisted client-side. */
export interface ChatMedia {
  url: string;
  kind: 'image' | 'video';
  /** Pixel size of the original when the sender's picker reported it. */
  width?: number;
  height?: number;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  media?: ChatMedia;
}

/** What `send` carries alongside the text. */
export interface ChatAttachment {
  mediaId: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
}

export interface ChatSummary {
  id: string;
  peer: ChatPerson;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatThread {
  id: string;
  peer: ChatPerson;
  /** The signed-in account, so their own picture sits beside their messages. */
  me: ChatPerson | null;
  messages: ChatMessage[];
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRepo {
  list(): Promise<ChatSummary[]>;
  people(search?: string): Promise<ChatPerson[]>;
  /** The conversation with an account, created on first open. Friends only. */
  open(userId: string): Promise<ChatSummary>;
  thread(id: string): Promise<ChatThread | null>;
  /** Store a picked photo or clip and hand back its storage id. */
  upload(file: Blob): Promise<string>;
  send(id: string, body: string, attachment?: ChatAttachment): Promise<ChatMessage>;
  markRead(id: string): Promise<void>;
}

const chatId = (id: string) => id as Id<'directChats'>;
const fileId = (id: string) => id as Id<'_storage'>;

export function createChatRepo(convex: ConvexCaller): ChatRepo {
  return {
    list: () => convex.query(api.chats.list, {}),
    people: (search) => convex.query(api.chats.people, search?.trim() ? { search } : {}),
    open: (userId) => convex.mutation(api.chats.open, { userId: userId as Id<'users'> }),
    thread: (id) => convex.query(api.chats.thread, { id: chatId(id) }),
    async upload(file) {
      const uploadUrl = await convex.mutation(api.chats.generateUploadUrl, {});
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: file.type ? { 'Content-Type': file.type } : undefined,
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = (await response.json()) as { storageId: string };
      if (!storageId) throw new Error('Upload did not return a file id');
      return storageId;
    },
    send: (id, body, attachment) =>
      convex.mutation(api.chats.send, {
        id: chatId(id),
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
      await convex.mutation(api.chats.markRead, { id: chatId(id) });
    },
  };
}
