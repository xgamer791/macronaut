import { describe, expect, it } from 'vitest';
import { backend, signIn } from './helpers';

describe('notifications', () => {
  it('fires one friend-request event when a person follows and retracts it on unfollow', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({
      handle: 'alice_runner',
      displayName: 'Alice Runner',
      isPublic: true,
    });
    await bob.repos.profile.update({
      handle: 'bob_lifts',
      displayName: 'Bob Lifts',
      isPublic: true,
    });

    await bob.repos.profile.setFollow('alice_runner', true);
    const feed = await alice.repos.notifications.list();
    expect(feed).toMatchObject({
      unreadCount: 1,
      items: [
        {
          kind: 'friend_request',
          actor: { handle: 'bob_lifts', displayName: 'Bob Lifts' },
          title: 'New friend request',
          read: false,
        },
      ],
    });

    await bob.repos.profile.setFollow('alice_runner', true);
    expect((await alice.repos.notifications.list()).items).toHaveLength(1);

    await bob.repos.profile.setFollow('alice_runner', false);
    expect(await alice.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });

    await bob.repos.profile.setFollow('alice_runner', true);
    await alice.repos.profile.setFollow('bob_lifts', true);
    expect(await alice.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
    expect(await bob.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
  });

  it('fires private chat-message events and clears them when the chat is read', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await stranger.repos.profile.update({ handle: 'stranger', isPublic: true });
    await alice.repos.profile.setFollow('bob_lifts', true);
    await bob.repos.profile.setFollow('alice_runner', true);

    const chat = await alice.repos.chats.open(bob.userId);
    await alice.repos.chats.send(chat.id, 'Training at six?');

    expect(await alice.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
    const feed = await bob.repos.notifications.list();
    expect(feed.items[0]).toMatchObject({
      kind: 'chat_message',
      body: 'Training at six?',
      chatId: chat.id,
      actor: { handle: 'alice_runner' },
      read: false,
    });
    expect(feed.unreadCount).toBe(1);

    await stranger.repos.notifications.markRead(feed.items[0]!.id);
    expect((await bob.repos.notifications.list()).unreadCount).toBe(1);

    await bob.repos.chats.markRead(chat.id);
    expect((await bob.repos.notifications.list()).unreadCount).toBe(0);
  });

  it('supports individual and mark-all read state and purges events with an account', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await bob.repos.profile.setFollow('alice_runner', true);
    await alice.repos.profile.setFollow('bob_lifts', true);

    const chat = await bob.repos.chats.open(alice.userId);
    await bob.repos.chats.send(chat.id, 'First');
    await bob.repos.chats.send(chat.id, 'Second');
    const feed = await alice.repos.notifications.list();
    expect(feed.unreadCount).toBe(2);

    await alice.repos.notifications.markRead(feed.items[0]!.id);
    expect((await alice.repos.notifications.list()).unreadCount).toBe(1);
    await alice.repos.notifications.markAllRead();
    expect((await alice.repos.notifications.list()).unreadCount).toBe(0);

    await bob.repos.account.deleteAllData();
    expect(await alice.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
    expect(await t.run(async (ctx) => ctx.db.query('notifications').collect())).toEqual([]);
  });
});
