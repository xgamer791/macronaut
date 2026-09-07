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

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
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
  send(id: string, body: string): Promise<ChatMessage>;
  markRead(id: string): Promise<void>;
}

const chatId = (id: string) => id as Id<'directChats'>;

export function createChatRepo(convex: ConvexCaller): ChatRepo {
  return {
    list: () => convex.query(api.chats.list, {}),
    people: (search) => convex.query(api.chats.people, search?.trim() ? { search } : {}),
    open: (userId) => convex.mutation(api.chats.open, { userId: userId as Id<'users'> }),
    thread: (id) => convex.query(api.chats.thread, { id: chatId(id) }),
    send: (id, body) => convex.mutation(api.chats.send, { id: chatId(id), body }),
    async markRead(id) {
      await convex.mutation(api.chats.markRead, { id: chatId(id) });
    },
  };
}
