import { describe, expect, it } from 'vitest';
import { backend, signIn } from './helpers';

describe('notifications', () => {
  it('congratulates a calorie goal once when its ring closes', async () => {
    const t = backend();
    const person = await signIn(t, 'goal@example.com', 'Goal Getter');
    await person.repos.goals.saveConfig({
      effectiveFrom: '2026-01-01',
      mode: 'same-daily',
      baseTarget: { calories: 500 },
      weeklyMode: 'sum-daily',
    });

    await person.repos.diary.add({
      date: '2026-09-07',
      meal: 'breakfast',
      name: 'Breakfast',
      sourceType: 'manual',
      quantity: 1,
      unit: 'meal',
      nutrition: { calories: 300 },
    });
    expect(await person.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });

    await person.repos.diary.add({
      date: '2026-09-07',
      meal: 'lunch',
      name: 'Lunch',
      sourceType: 'manual',
      quantity: 1,
      unit: 'meal',
      nutrition: { calories: 200 },
    });
    expect(await person.repos.notifications.list()).toMatchObject({
      unreadCount: 1,
      items: [
        {
          kind: 'calorie_goal',
          title: 'Calorie goal complete',
          body: expect.stringContaining('Another awesome day!'),
          goalDate: '2026-09-07',
          read: false,
        },
      ],
    });

    await person.repos.diary.add({
      date: '2026-09-07',
      meal: 'snacks',
      name: 'Snack',
      sourceType: 'manual',
      quantity: 1,
      unit: 'meal',
      nutrition: { calories: 50 },
    });
    expect((await person.repos.notifications.list()).items).toHaveLength(1);
  });

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
    // Accepting clears the request from the accepter's bell...
    expect(await alice.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
    // ...and tells the person who asked, who would otherwise never learn that
    // the friendship exists or that they can now send a message.
    expect(await bob.repos.notifications.list()).toMatchObject({
      unreadCount: 1,
      items: [
        {
          kind: 'friend_accepted',
          actor: { handle: 'alice_runner', friendship: 'friends' },
          title: 'Friend request accepted',
          read: false,
        },
      ],
    });
  });

  /** The whole loop, on two accounts that have never edited a profile — the
   * state every real account starts in. Each step is answered from the bell,
   * because a private profile page cannot be opened to answer it. */
  it('carries a friend request from search to an accepted, messageable friendship', async () => {
    const t = backend();
    const holly = await signIn(t, 'holly@example.com', 'Holly Ky');
    const chris = await signIn(t, 'chris@example.com', 'Christopher Garcia');

    const [found] = await chris.repos.chats.people('holly');
    expect(found).toMatchObject({ displayName: 'Holly Ky', friendship: 'none' });

    // Chris asks. Holly's bell carries the request and its Accept.
    await chris.repos.profile.requestFriend(found!.id, true);
    expect(await holly.repos.notifications.list()).toMatchObject({
      unreadCount: 1,
      items: [
        {
          kind: 'friend_request',
          actor: { id: chris.userId, displayName: 'Christopher Garcia', friendship: 'incoming' },
        },
      ],
    });
    // Nothing is messageable yet, in either direction.
    await expect(chris.repos.chats.open(holly.userId)).rejects.toThrow(/friends/i);
    await expect(holly.repos.chats.open(chris.userId)).rejects.toThrow(/friends/i);

    // Holly accepts from the notification itself, by account id.
    const request = (await holly.repos.notifications.list()).items[0]!;
    await holly.repos.profile.requestFriend(request.actor.id, true);

    expect(await holly.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
    expect(await chris.repos.notifications.list()).toMatchObject({
      unreadCount: 1,
      items: [{ kind: 'friend_accepted', actor: { id: holly.userId, friendship: 'friends' } }],
    });

    const chat = await chris.repos.chats.open(holly.userId);
    await chris.repos.chats.send(chat.id, 'Hey!');
    expect(await holly.repos.chats.list()).toMatchObject([
      { peer: { id: chris.userId, friendship: 'friends' }, unreadCount: 1 },
    ]);
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

    // Alice hears that Bob accepted, and never hears her own message back.
    expect((await alice.repos.notifications.list()).items).toEqual([
      expect.objectContaining({ kind: 'friend_accepted' }),
    ]);
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
