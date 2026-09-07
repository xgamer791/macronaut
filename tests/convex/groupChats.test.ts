import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { NOTIFY_MEMBER_CAP, SENDS_PER_MINUTE } from '../../convex/groupChats';
import { backend, signIn, tick, type Backend } from './helpers';

/** A file already in storage, standing in for a completed upload. */
function storedFile(t: Backend, type: string) {
  return t.run(async (ctx) => ctx.storage.store(new Blob(['bytes'], { type })));
}

async function seedGym(t: Backend) {
  return t.run(async (ctx) =>
    ctx.db.insert('gyms', {
      provider: 'google',
      placeId: 'ChIJ-golds-venice',
      name: "Gold's Gym Venice",
      address: '360 Hampton Dr, Venice, CA 90291, USA',
      lat: 33.9946,
      lng: -118.4747,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
}

/** An owner-less gym group of `n` members, each with a public profile. */
async function gymGroup(t: Backend, n: number) {
  const gymId = await seedGym(t);
  const people = [];
  for (let i = 0; i < n; i += 1) {
    const person = await signIn(t, `m${i}@example.com`, `Member ${i}`);
    await person.repos.profile.update({ handle: `member_${i}`, isPublic: true });
    await person.repos.gyms.claim({ gymId, joinGroup: true });
    people.push(person);
  }
  const group = (await people[0].repos.gyms.mine())?.group;
  if (!group) throw new Error('expected a group');
  // Seats and the first message must not share a millisecond: unread counts
  // start where the seat does.
  await tick();
  return { group, people };
}

describe('group chat', () => {
  it('is for members: a stranger sees no messages and cannot send', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 2);
    await people[0].repos.groupChats.send(group.id, 'members only');
    const stranger = await signIn(t, 'stranger@example.com');

    // A public group's thread shows a non-member the group and nothing else,
    // so the screen can offer to join.
    const outside = await stranger.repos.groupChats.thread(group.id);
    expect(outside).toMatchObject({ group: { isMember: false }, messages: [], unreadCount: 0 });
    await expect(stranger.repos.groupChats.send(group.id, 'Hello?')).rejects.toThrow(
      /not available/i,
    );
    expect(await stranger.repos.groupChats.list()).toEqual([]);

    // A private group looks like a missing one.
    const owner = await signIn(t, 'owner@example.com', 'Owner');
    const secret = await owner.repos.groups.create({ name: 'Secret club', isPublic: false });
    expect(await stranger.repos.groupChats.thread(secret.id)).toBeNull();
    await expect(stranger.repos.groupChats.send(secret.id, 'Psst')).rejects.toThrow(
      /not available/i,
    );

    // Leaving revokes both.
    await people[1].repos.groups.leave(group.id);
    expect(await people[1].repos.groupChats.thread(group.id)).toMatchObject({
      group: { isMember: false },
      messages: [],
    });
    await expect(people[1].repos.groupChats.send(group.id, 'Still here?')).rejects.toThrow(
      /not available/i,
    );
    await expect(t.query(api.groupChats.thread, { id: group.id as never })).rejects.toThrow(
      /not signed in/i,
    );
  });

  it('carries text and media to every member with the sender named', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 3);
    const [a, b, c] = people;

    const sent = await a.repos.groupChats.send(group.id, '  Leg day at 6?  ');
    expect(sent).toMatchObject({ body: 'Leg day at 6?', isMine: true, canDelete: true });
    expect(sent.sender.handle).toBe('member_0');
    await tick();
    const image = await storedFile(t, 'image/jpeg');
    await b.repos.groupChats.send(group.id, '', {
      mediaId: image,
      kind: 'image',
      width: 1200,
      height: 900,
    });

    const seen = await c.repos.groupChats.thread(group.id);
    expect(seen?.group.id).toBe(group.id);
    expect(seen?.me?.handle).toBe('member_2');
    expect(seen?.messages.map((m) => m.sender.displayName)).toEqual(['Member 0', 'Member 1']);
    expect(seen?.messages[0]).toMatchObject({ body: 'Leg day at 6?', isMine: false, canDelete: false });
    expect(seen?.messages[1]?.media).toMatchObject({ kind: 'image', width: 1200, height: 900 });
    expect(seen?.messages[1]?.media?.url).toEqual(expect.any(String));
    expect(seen?.unreadCount).toBe(2);

    const listed = await c.repos.groupChats.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      unreadCount: 2,
      lastMessage: { body: '', senderName: 'Member 1', isMine: false, mediaKind: 'image' },
    });
    expect(listed[0].lastMessageAt).toBe(seen?.messages[1]?.createdAt);
  });

  it('counts unread per member, never your own, and clears on read', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 3);
    const [a, b, c] = people;
    await a.repos.groupChats.send(group.id, 'one');
    await tick();
    await b.repos.groupChats.send(group.id, 'two');

    expect((await a.repos.groupChats.thread(group.id))?.unreadCount).toBe(1);
    expect((await b.repos.groupChats.thread(group.id))?.unreadCount).toBe(0);
    expect((await c.repos.groupChats.thread(group.id))?.unreadCount).toBe(2);

    await c.repos.groupChats.markRead(group.id);
    expect((await c.repos.groupChats.thread(group.id))?.unreadCount).toBe(0);
    await tick();
    await a.repos.groupChats.send(group.id, 'three');
    expect((await c.repos.groupChats.thread(group.id))?.unreadCount).toBe(1);
    expect((await c.repos.groupChats.list())[0]?.unreadCount).toBe(1);

    // Joining a busy group starts at zero, not at everything ever said.
    await tick();
    const late = await signIn(t, 'late@example.com', 'Late');
    await late.repos.profile.update({ handle: 'late_one', isPublic: true });
    await late.repos.gyms.claim({ gymId: group.gymId as string, joinGroup: true });
    expect((await late.repos.groupChats.thread(group.id))?.unreadCount).toBe(0);
    expect((await late.repos.groupChats.thread(group.id))?.messages).toHaveLength(3);
    await tick();
    await a.repos.groupChats.send(group.id, 'four');
    expect((await late.repos.groupChats.thread(group.id))?.unreadCount).toBe(1);
  });

  it('keeps one bell row per group that counts up while unread', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 3);
    const [a, b, c] = people;

    await a.repos.groupChats.send(group.id, 'first');
    await tick();
    await a.repos.groupChats.send(group.id, 'second');
    await tick();
    await b.repos.groupChats.send(group.id, 'third');

    const bell = await c.repos.notifications.list();
    expect(bell.unreadCount).toBe(1);
    expect(bell.items).toHaveLength(1);
    expect(bell.items[0]).toMatchObject({
      kind: 'group_message',
      groupId: group.id,
      count: 3,
      title: "New messages in Gold's Gym Venice",
      body: '3 new messages · Member 1: third',
      read: false,
    });
    // The sender never hears about their own message.
    expect((await a.repos.notifications.list()).items.map((i) => i.kind)).toEqual([
      'group_message',
    ]);
    expect((await a.repos.notifications.list()).items[0]).toMatchObject({ count: 1 });

    await c.repos.groupChats.markRead(group.id);
    expect(await c.repos.notifications.list()).toMatchObject({ unreadCount: 0 });
    expect((await c.repos.notifications.list()).items[0]).toMatchObject({ read: true });

    await tick();
    await a.repos.groupChats.send(group.id, 'fourth');
    const again = await c.repos.notifications.list();
    expect(again.unreadCount).toBe(1);
    expect(again.items).toHaveLength(1);
    expect(again.items[0]).toMatchObject({ count: 1, body: '1 new message · Member 0: fourth' });
  });

  it('lets the sender delete their own message, and only the owner of an owned group delete others', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 3);
    const [first, second, third] = people;
    const mine = await first.repos.groupChats.send(group.id, 'mine');
    await tick();
    const theirs = await second.repos.groupChats.send(group.id, 'theirs');

    // The first claimant of a gym group is nobody's owner.
    await expect(first.repos.groupChats.remove(theirs.id)).rejects.toThrow(/only the sender/i);
    await expect(third.repos.groupChats.remove(mine.id)).rejects.toThrow(/only the sender/i);
    await first.repos.groupChats.remove(mine.id);
    expect((await third.repos.groupChats.thread(group.id))?.messages.map((m) => m.body)).toEqual([
      'theirs',
    ]);

    // An owned group: its owner may remove anything.
    const owner = await signIn(t, 'owner@example.com', 'Owner');
    const member = await signIn(t, 'member@example.com', 'Member');
    const club = await owner.repos.groups.create({ name: 'Run club' });
    await member.repos.groups.join(club.id);
    const post = await member.repos.groupChats.send(club.id, 'spam');
    const image = await storedFile(t, 'image/png');
    await tick();
    const withFile = await member.repos.groupChats.send(club.id, 'pic', {
      mediaId: image,
      kind: 'image',
    });
    await owner.repos.groupChats.remove(post.id);
    await owner.repos.groupChats.remove(withFile.id);
    expect((await member.repos.groupChats.thread(club.id))?.messages).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toEqual([]);
    expect((await member.repos.groupChats.list())).toEqual([]);
  });

  it('removes only what a deleted account wrote; the thread survives', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 3);
    const [leaver, stayer] = people;
    const image = await storedFile(t, 'image/jpeg');
    await leaver.repos.groupChats.send(group.id, 'going', { mediaId: image, kind: 'image' });
    await tick();
    await stayer.repos.groupChats.send(group.id, 'staying');

    expect(await leaver.as.mutation(api.account.deleteAccount, {})).toEqual({ done: true });

    const after = await stayer.repos.groupChats.thread(group.id);
    expect(after?.messages.map((m) => m.body)).toEqual(['staying']);
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query('groupMessages').collect())).toHaveLength(1);
  });

  it('takes the thread and its bell rows down with the group', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com', 'Owner');
    const member = await signIn(t, 'member@example.com', 'Member');
    const club = await owner.repos.groups.create({ name: 'Run club' });
    await member.repos.groups.join(club.id);
    await tick();
    const image = await storedFile(t, 'image/png');
    await member.repos.groupChats.send(club.id, 'route?', { mediaId: image, kind: 'image' });
    expect((await owner.repos.notifications.list()).items).toHaveLength(1);

    await owner.repos.groups.remove(club.id);

    expect(await member.repos.groupChats.thread(club.id)).toBeNull();
    expect(await member.repos.groupChats.list()).toEqual([]);
    expect(await owner.repos.notifications.list()).toEqual({ items: [], unreadCount: 0 });
    expect(await t.run(async (ctx) => ctx.db.query('groupMessages').collect())).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toEqual([]);
  });

  it('refuses an empty message, truncates long ones, and slows a flood', async () => {
    const t = backend();
    const { group, people } = await gymGroup(t, 2);
    await expect(people[0].repos.groupChats.send(group.id, '   ')).rejects.toThrow(
      /write a message/i,
    );
    const long = await people[0].repos.groupChats.send(group.id, 'x'.repeat(2500));
    expect(long.body).toHaveLength(2000);

    for (let i = 1; i < SENDS_PER_MINUTE; i += 1) {
      await people[0].repos.groupChats.send(group.id, `m${i}`);
    }
    await expect(people[0].repos.groupChats.send(group.id, 'one too many')).rejects.toThrow(
      /slow down/i,
    );
    expect(NOTIFY_MEMBER_CAP).toBeGreaterThan(SENDS_PER_MINUTE);
  });
});
