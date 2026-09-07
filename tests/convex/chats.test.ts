import { describe, expect, it } from 'vitest';
import type { ConvexCaller } from '../../src/repositories/convexCall';
import { createRepos } from '../../src/state/AppProvider';
import { backend, signIn, tick } from './helpers';

/** A file already in storage, standing in for a completed upload. */
function storedFile(t: ReturnType<typeof backend>, type: string) {
  return t.run(async (ctx) => ctx.storage.store(new Blob(['bytes'], { type })));
}

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

    const chat = await bob.repos.chats.open(alice.userId);
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
   * because every profile is created private. Searching a first name has to
   * find them anyway, or there is no one to befriend and nothing to message. */
  it('finds a default private account by first name, and messages it once friends', async () => {
    const t = backend();
    const holly = await signIn(t, 'holly@example.com');
    const bob = await signIn(t, 'bob@example.com');

    // No isPublic anywhere: both accounts are left exactly as created.
    await holly.repos.profile.update({ handle: 'holly_ky', displayName: 'Holly Ky' });
    await bob.repos.profile.update({ handle: 'bob_lifts', displayName: 'Bob Lifts' });

    // A first name, either case, the surname, part of the handle, the whole
    // handle, and the @ people type beside it all reach the same person.
    for (const term of ['holly', 'Holly', 'HOLLY KY', 'ky', 'holly_ky', '@holly_ky']) {
      expect(await bob.repos.chats.people(term)).toEqual([
        expect.objectContaining({ handle: 'holly_ky', friendship: 'none' }),
      ]);
    }

    // Friendship, not page visibility, is the gate on a conversation.
    await expect(bob.repos.chats.open(holly.userId)).rejects.toThrow(/friends/i);
    await bob.repos.profile.setFollow('holly_ky', true);
    await expect(bob.repos.chats.open(holly.userId)).rejects.toThrow(/friends/i);
    expect(await holly.repos.chats.people()).toEqual([
      expect.objectContaining({ handle: 'bob_lifts', friendship: 'incoming' }),
    ]);

    await holly.repos.profile.setFollow('bob_lifts', true);
    const chat = await bob.repos.chats.open(holly.userId);
    await bob.repos.chats.send(chat.id, 'Morning run tomorrow?');
    expect(await holly.repos.chats.list()).toEqual([
      expect.objectContaining({
        peer: expect.objectContaining({ handle: 'bob_lifts', friendship: 'friends' }),
        unreadCount: 1,
      }),
    ]);
  });

  /** Search reads the accounts table, so an account that signed up and only
   * ever logged food — no profile row at all — is found by the name it signed
   * up with, befriended by id, and messaged. */
  it('finds an account that has never edited its profile, straight from the users table', async () => {
    const t = backend();
    const holly = await signIn(t, 'holly@example.com', 'Holly Ky');
    const bob = await signIn(t, 'bob@example.com');
    await bob.repos.profile.update({ handle: 'bob_lifts' });
    expect(await t.run(async (ctx) => ctx.db.query('profiles').collect())).toHaveLength(1);

    // No profile row, so no handle yet — but the account is right there.
    const [found] = await bob.repos.chats.people('holly');
    expect(found).toEqual(
      expect.objectContaining({ id: holly.userId, handle: null, displayName: 'Holly Ky' }),
    );

    // The friend request is addressed to the account, and gives it the same
    // row and handle it would have claimed for itself.
    await bob.repos.profile.requestFriend(holly.userId, true);
    expect(await bob.repos.chats.people('holly')).toEqual([
      expect.objectContaining({ id: holly.userId, handle: 'holly_ky', friendship: 'outgoing' }),
    ]);
    // Holly sees the request even though she never touched her profile.
    expect((await holly.repos.notifications.list()).items).toEqual([
      expect.objectContaining({
        kind: 'friend_request',
        actor: expect.objectContaining({ id: bob.userId, handle: 'bob_lifts' }),
      }),
    ]);

    await holly.repos.profile.requestFriend(bob.userId, true);
    const chat = await bob.repos.chats.open(holly.userId);
    expect(chat.peer).toEqual(expect.objectContaining({ id: holly.userId, handle: 'holly_ky' }));
  });

  /** One person, two sign-ups: the same address on two accounts is not a
   * second person to find, so a search never hands you yourself. */
  it('never returns your own account, nor another account with your email', async () => {
    const t = backend();
    const chris = await signIn(t, 'chris@example.com', 'Christopher Garcia');
    const chrisAgain = await signIn(t, 'Chris@Example.com', 'Christopher Garcia');
    const holly = await signIn(t, 'holly@example.com', 'Holly Ky');
    await chris.repos.profile.update({ handle: 'christopher_garcia' });

    expect(await chris.repos.chats.people('ch')).toEqual([]);
    expect(await chrisAgain.repos.chats.people('christopher')).toEqual([]);
    expect(await holly.repos.chats.people('ch')).toEqual([
      expect.objectContaining({ handle: 'christopher_garcia' }),
      expect.objectContaining({ id: chrisAgain.userId, handle: null }),
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

    await expect(alice.repos.chats.open(bob.userId)).rejects.toThrow(/friends/i);
    await alice.repos.profile.setFollow('bob_lifts', true);
    await expect(alice.repos.chats.open(bob.userId)).rejects.toThrow(/friends/i);
    await bob.repos.profile.setFollow('alice_runner', true);

    const chat = await alice.repos.chats.open(bob.userId);
    await alice.repos.chats.send(chat.id, 'Private message');

    expect(await stranger.repos.chats.thread(chat.id)).toBeNull();
    await expect(stranger.repos.chats.send(chat.id, 'Intrusion')).rejects.toThrow(/not available/i);
    expect(await stranger.repos.chats.list()).toEqual([]);

    await alice.repos.profile.setFollow('bob_lifts', false);
    await expect(alice.repos.chats.send(chat.id, 'No longer friends')).rejects.toThrow(/friends/i);
  });

  it('sends a photo or a clip, and shows an attachment-only message in the chat list', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await alice.repos.profile.setFollow('bob_lifts', true);
    await bob.repos.profile.setFollow('alice_runner', true);
    const chat = await alice.repos.chats.open(bob.userId);

    const imageId = await storedFile(t, 'image/jpeg');
    const videoId = await storedFile(t, 'video/mp4');

    // A picture with a caption, then a clip on its own.
    await alice.repos.chats.send(chat.id, 'Post-run', {
      mediaId: imageId,
      kind: 'image',
      width: 1200,
      height: 900,
    });
    await tick();
    await alice.repos.chats.send(chat.id, '', { mediaId: videoId, kind: 'video' });

    const thread = await bob.repos.chats.thread(chat.id);
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.messages[0]).toMatchObject({
      body: 'Post-run',
      media: { kind: 'image', width: 1200, height: 900 },
    });
    expect(thread?.messages[0]?.media?.url).toEqual(expect.any(String));
    expect(thread?.messages[1]).toMatchObject({ body: '', media: { kind: 'video' } });

    // The thread names the viewer too, so their own picture sits beside
    // their messages.
    expect(thread?.me).toMatchObject({ id: bob.userId, handle: 'bob_lifts' });

    // A message that is only an attachment still reads as something in the
    // chat list and in the bell.
    const list = await bob.repos.chats.list();
    expect(list[0]?.lastMessage).toMatchObject({ body: '', media: { kind: 'video' } });
    const bell = await bob.repos.notifications.list();
    expect(bell.items[0]).toMatchObject({ body: 'Video' });
  });

  it('refuses an empty message, and keeps attachments inside the friendship rule', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await alice.repos.profile.setFollow('bob_lifts', true);
    await bob.repos.profile.setFollow('alice_runner', true);
    const chat = await alice.repos.chats.open(bob.userId);

    await expect(alice.repos.chats.send(chat.id, '   ')).rejects.toThrow(/write a message/i);

    const imageId = await storedFile(t, 'image/jpeg');
    await alice.repos.profile.setFollow('bob_lifts', false);
    await expect(
      alice.repos.chats.send(chat.id, '', { mediaId: imageId, kind: 'image' }),
    ).rejects.toThrow(/friends/i);
  });

  it('removes the conversation and its messages when either account clears its data', async () => {
    const t = backend();
    const alice = await signIn(t, 'alice@example.com');
    const bob = await signIn(t, 'bob@example.com');
    await alice.repos.profile.update({ handle: 'alice_runner', isPublic: true });
    await bob.repos.profile.update({ handle: 'bob_lifts', isPublic: true });
    await alice.repos.profile.setFollow('bob_lifts', true);
    await bob.repos.profile.setFollow('alice_runner', true);
    const chat = await alice.repos.chats.open(bob.userId);
    await alice.repos.chats.send(chat.id, 'Stored in Convex');

    // An attachment goes with the message, rather than being left in storage.
    const imageId = await storedFile(t, 'image/jpeg');
    await alice.repos.chats.send(chat.id, '', { mediaId: imageId, kind: 'image' });

    await alice.repos.account.deleteAllData();
    expect(await t.run(async (ctx) => ctx.db.query('directChats').collect())).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query('chatMessages').collect())).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toEqual([]);
    expect(await bob.repos.chats.list()).toEqual([]);
  });
});
