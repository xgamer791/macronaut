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
