import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { ChatPerson } from './chatRepo';
import type { ConvexCaller } from './convexCall';

export type NotificationKind =
  | 'friend_request'
  | 'friend_accepted'
  | 'chat_message'
  | 'calorie_goal'
  | 'group_message';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** Carries the friendship state, so a request is answered where it lands. */
  actor: ChatPerson;
  title: string;
  body: string;
  chatId?: string;
  /** The group whose chat this one row stands for, with how many new
   * messages it has gathered since it was last read. */
  groupId?: string;
  count?: number;
  goalDate?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}

export interface NotificationRepo {
  list(): Promise<NotificationFeed>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

const notificationId = (id: string) => id as Id<'notifications'>;

export function createNotificationRepo(convex: ConvexCaller): NotificationRepo {
  return {
    list: () => convex.query(api.notifications.list, {}),
    async markRead(id) {
      await convex.mutation(api.notifications.markRead, { id: notificationId(id) });
    },
    async markAllRead() {
      await convex.mutation(api.notifications.markAllRead, {});
    },
  };
}
