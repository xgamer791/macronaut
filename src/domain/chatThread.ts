import type { ChatMessage } from '@/repositories/chatRepo';

/** Messages from one person inside this window read as a single turn. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** A message that may name its own sender. A direct message never does — its
 * other person is the one peer — while a group message must, since a group
 * has many. */
export type AuthoredMessage = ChatMessage & { sender?: { id: string } };

/** One message plus what the layout needs to know about its neighbours. */
export interface ChatTurn<M extends ChatMessage = ChatMessage> {
  message: M;
  /** First of a run by one person — carries the extra top gutter. */
  first: boolean;
  /** Last of a run — carries the tail corner, the avatar and the time. */
  last: boolean;
  /** Day heading to draw above this message, when the date changed. */
  daySeparator: string | null;
}

/**
 * Runs of messages from one person, and the day headings between them.
 * Resolving it once per thread keeps every row's shape a pure lookup, and
 * keeps the shape rules testable without a renderer.
 *
 * `messages` must be in ascending time order, which is the order the thread
 * query returns.
 */
export function groupMessages<M extends AuthoredMessage>(
  messages: M[],
  now: Date = new Date(),
): ChatTurn<M>[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const dayChanged = !previous || !sameDay(previous.createdAt, message.createdAt);
    return {
      message,
      first: dayChanged || !continues(previous, message),
      last: !continues(message, next),
      daySeparator: dayChanged ? dayLabel(message.createdAt, now) : null,
    };
  });
}

/** Who a message is from, as far as a run cares: the viewer, a named sender,
 * or the one peer of a direct chat. */
function senderKey(message: AuthoredMessage): string {
  if (message.isMine) return 'me';
  return message.sender ? `sender:${message.sender.id}` : 'peer';
}

/** Whether `b` belongs to the run `a` started. */
export function continues(
  a: AuthoredMessage | undefined,
  b: AuthoredMessage | undefined,
): boolean {
  if (!a || !b) return false;
  if (senderKey(a) !== senderKey(b)) return false;
  if (!sameDay(a.createdAt, b.createdAt)) return false;
  const gap = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return Number.isFinite(gap) && gap >= 0 && gap <= GROUP_WINDOW_MS;
}

/** Today and Yesterday by name, this week by weekday, anything older by date. */
export function dayLabel(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Clock time under the last bubble of a run. */
export function messageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function sameDay(a: string, b: string): boolean {
  return dayKey(a) === dayKey(b);
}

function dayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toDateString();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
