import { describe, expect, it } from 'vitest';
import type { ConvexCaller } from '../../src/repositories/convexCall';
import { createRepos } from '../../src/state/AppProvider';
import { backend, signIn } from './helpers';

describe('direct chats', () => {
  it('lists contacts, searches public profiles and persists messages between sessions', async () => {
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

    expect(await bob.repos.chats.people()).toContainEqual(
      expect.objectContaining({ handle: 'alice_runner', friendship: 'outgoing' }),
    );
    expect(await alice.repos.chats.people()).toContainEqual(
      expect.objectContaining({ handle: 'bob_lifts', friendship: 'incoming' }),
    );
    expect(await bob.repos.chats.people('RUNNER')).toEqual([
      expect.objectContaining({ handle: 'alice_runner', friendship: 'outgoing' }),
    ]);

    await alice.repos.profile.setFollow('bob_lifts', true);

    const chat = await bob.repos.chats.open('alice_runner');
    await bob.repos.chats.send(chat.id, '  Morning run tomorrow?  ');

    const aliceList = await alice.repos.chats.list();
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0]).toMatchObject({
      peer: { handle: 'bob_lifts', displayName: 'Bob Lifts' },
      unreadCount: 1,
      lastMessage: { body: 'Morning run tomorrow?', isMine: false },
    });

    // A new authenticated session reads the same database rows. Logging out
    // only removes the local session; it never owns the conversation data.
    const nextSession = await t.run(async (ctx) =>
      ctx.db.insert('authSessions', {
        userId: alice.userId,
        expirationTime: Date.now() + 86_400_000,
      }),
    );
    const signedBackIn = t.withIdentity({ subject: `${alice.userId}|${nextSession}` });
    const caller = {
      query: (fn: unknown, args: unknown) => (signedBackIn.query as Function)(fn, args),
      mutation: (fn: unknown, args: unknown) => (signedBackIn.mutation as Function)(fn, args),
      action: (fn: unknown, args: unknown) => (signedBackIn.action as Function)(fn, args),
    } as unknown as ConvexCaller;
    const again = createRepos(caller);
    expect((await again.chats.thread(chat.id))?.messages).toEqual([
      expect.objectContaining({ body: 'Morning run tomorrow?', isMine: false }),
    ]);

    await again.chats.markRead(chat.id);
    expect((await again.chats.list())[0]?.unreadCount).toBe(0);
  });

  /** The case the app actually ships: nobody has touched the privacy toggle,
   * because every profile is created private. Search has to work anyway, or
   * there is no one to befriend and nothing to message. */
  it('finds a default private account by its exact handle, and messages it once friends', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');

    // No isPublic anywhere: both accounts are left exactly as created.
    await alice.repos.profile.update({ handle: 'alice_runner', displayName: 'Alice Runner' });
    await bob.repos.profile.update({ handle: 'bob_lifts', displayName: 'Bob Lifts' });

    expect(await bob.repos.chats.people('alice_runner')).toEqual([
      expect.objectContaining({ handle: 'alice_runner', friendship: 'none' }),
    ]);
    // The @ people type beside a handle is decoration, not part of it.
    expect(await bob.repos.chats.people('@alice_runner')).toEqual([
      expect.objectContaining({ handle: 'alice_runner' }),
    ]);
    // A private page is not browsable: no partial handle, no display name.
    expect(await bob.repos.chats.people('alice')).toEqual([]);
    expect(await bob.repos.chats.people('Alice Runner')).toEqual([]);

    // Friendship, not page visibility, is the gate on a conversation.
    await expect(bob.repos.chats.open('alice_runner')).rejects.toThrow(/friends/i);
    await bob.repos.profile.setFollow('alice_runner', true);
    await expect(bob.repos.chats.open('alice_runner')).rejects.toThrow(/friends/i);
    expect(await alice.repos.chats.people()).toEqual([
      expect.objectContaining({ handle: 'bob_lifts', friendship: 'incoming' }),
    ]);

    await alice.repos.profile.setFollow('bob_lifts', true);
    const chat = await bob.repos.chats.open('alice_runner');
    await bob.repos.chats.send(chat.id, 'Morning run tomorrow?');
    expect(await alice.repos.chats.list()).toEqual([
      expect.objectContaining({
        peer: expect.objectContaining({ handle: 'bob_lifts', friendship: 'friends' }),
        unreadCount: 1,
      }),
    ]);
  });

  it('browses a public profile by any part of its handle or name', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({
      handle: 'alice_runner',
      displayName: 'Alice Runner',
      isPublic: true,
    });
    await bob.repos.profile.update({ handle: 'bob_lifts' });

    for (const term of ['alice', 'runner', 'Alice Run', '@alice']) {
      expect(await bob.repos.chats.people(term)).toEqual([
        expect.objectContaining({ handle: 'alice_runner' }),
      ]);
    }
    // Searching never returns you to yourself.
    expect(await alice.repos.chats.people('alice')).toEqual([]);
  });

  it('requires accepted friendship and keeps a conversation private to its participants', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await stranger.repos.profile.update({ handle: 'stranger', isPublic: true });

    await expect(alice.repos.chats.open('bob_lifts')).rejects.toThrow(/friends/i);
    await alice.repos.profile.setFollow('bob_lifts', true);
    await expect(alice.repos.chats.open('bob_lifts')).rejects.toThrow(/friends/i);
    await bob.repos.profile.setFollow('alice_runner', true);

    const chat = await alice.repos.chats.open('bob_lifts');
    await alice.repos.chats.send(chat.id, 'Private message');

    expect(await stranger.repos.chats.thread(chat.id)).toBeNull();
    await expect(stranger.repos.chats.send(chat.id, 'Intrusion')).rejects.toThrow(/not available/i);
    expect(await stranger.repos.chats.list()).toEqual([]);

    await alice.repos.profile.setFollow('bob_lifts', false);
    await expect(alice.repos.chats.send(chat.id, 'No longer friends')).rejects.toThrow(/friends/i);
  });

  it('removes the conversation and its messages when either account clears its data', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await alice.repos.profile.setFollow('bob_lifts', true);
    await bob.repos.profile.setFollow('alice_runner', true);
    const chat = await alice.repos.chats.open('bob_lifts');
    await alice.repos.chats.send(chat.id, 'Stored in Convex');

    await alice.repos.account.deleteAllData();
    expect(await t.run(async (ctx) => ctx.db.query('directChats').collect())).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query('chatMessages').collect())).toEqual([]);
    expect(await bob.repos.chats.list()).toEqual([]);
  });
});
