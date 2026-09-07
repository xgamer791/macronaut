import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { ConvexCaller } from './convexCall';

export interface ChatPerson {
  handle: string;
  displayName: string;
  avatarUrl?: string;
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
  open(handle: string): Promise<ChatSummary>;
  thread(id: string): Promise<ChatThread | null>;
  send(id: string, body: string): Promise<ChatMessage>;
  markRead(id: string): Promise<void>;
}

const chatId = (id: string) => id as Id<'directChats'>;

export function createChatRepo(convex: ConvexCaller): ChatRepo {
  return {
    list: () => convex.query(api.chats.list, {}),
    people: (search) => convex.query(api.chats.people, search?.trim() ? { search } : {}),
    open: (handle) => convex.mutation(api.chats.open, { handle }),
    thread: (id) => convex.query(api.chats.thread, { id: chatId(id) }),
    send: (id, body) => convex.mutation(api.chats.send, { id: chatId(id), body }),
    async markRead(id) {
      await convex.mutation(api.chats.markRead, { id: chatId(id) });
    },
  };
}
