import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, signIn, type Backend } from './helpers';

const PLACE = 'ChIJ-golds-venice';

async function seedGym(t: Backend, placeId = PLACE, name = "Gold's Gym Venice") {
  return t.run(async (ctx) =>
    ctx.db.insert('gyms', {
      provider: 'google',
      placeId,
      name,
      address: '360 Hampton Dr, Venice, CA 90291, USA',
      lat: 33.9946,
      lng: -118.4747,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
}

describe('home gym', () => {
  it('claims a gym, creates its one group, and seats the claimant as a plain member', async () => {
    const t = backend();
    const gymId = await seedGym(t);
    const first = await signIn(t, 'first@example.com', 'First Person');

    const mine = await first.repos.gyms.claim({ gymId, joinGroup: true });
    expect(mine.gym.name).toBe("Gold's Gym Venice");
    expect(mine.group?.kind).toBe('gym');
    expect(mine.group?.handle).toBe('gold_s_gym_venice');
    expect(mine.group?.location).toBe('Venice, CA');
    expect(mine.group?.isMember).toBe(true);
    expect(mine.group?.isOwner).toBe(false);
    expect(mine.group?.memberCount).toBe(1);
    expect(mine.restriction).toBeNull();

    const seats = await t.run(async (ctx) => ctx.db.query('groupMembers').collect());
    expect(seats.map((seat) => seat.role)).toEqual(['member']);

    const me = await first.repos.profile.me();
    expect(me.homeGym?.name).toBe("Gold's Gym Venice");
    expect((await first.repos.gyms.mine())?.group?.id).toBe(mine.group?.id);
    expect((await first.repos.groups.mine()).map((g) => g.name)).toEqual(["Gold's Gym Venice"]);
  });

  it('puts the second claimant in the same group instead of a second one', async () => {
    const t = backend();
    const gymId = await seedGym(t);
    const first = await signIn(t, 'first@example.com');
    const second = await signIn(t, 'second@example.com');

    const a = await first.repos.gyms.claim({ gymId, joinGroup: true });
    const b = await second.repos.gyms.claim({ gymId, joinGroup: true });
    expect(b.group?.id).toBe(a.group?.id);
    expect(b.group?.memberCount).toBe(2);
    expect(b.group?.isOwner).toBe(false);
    expect((await first.repos.gyms.mine())?.group?.memberCount).toBe(2);

    const groups = await t.run(async (ctx) =>
      ctx.db
        .query('fitnessGroups')
        .withIndex('by_gym', (q) => q.eq('gymId', gymId))
        .collect(),
    );
    expect(groups).toHaveLength(1);
    expect(await t.run(async (ctx) => ctx.db.query('gyms').collect())).toHaveLength(1);
  });

  it('sets the gym without a seat when the toggle is off, and changing gyms moves the seat', async () => {
    const t = backend();
    const golds = await seedGym(t);
    const planet = await seedGym(t, 'ChIJ-planet-venice', 'Planet Fitness');
    const person = await signIn(t, 'person@example.com');

    const quiet = await person.repos.gyms.claim({ gymId: golds, joinGroup: false });
    expect(quiet.group).toBeNull();
    expect((await person.repos.profile.me()).homeGym?.id).toBe(golds);
    expect(await person.repos.groups.mine()).toEqual([]);

    const joined = await person.repos.gyms.claim({ gymId: golds, joinGroup: true });
    expect(joined.group?.isMember).toBe(true);

    const moved = await person.repos.gyms.claim({ gymId: planet, joinGroup: true });
    expect(moved.gym.name).toBe('Planet Fitness');
    expect(moved.group?.isMember).toBe(true);
    expect((await person.repos.groups.mine()).map((g) => g.name)).toEqual(['Planet Fitness']);

    await person.repos.gyms.clear();
    expect(await person.repos.gyms.mine()).toBeNull();
    expect((await person.repos.profile.me()).homeGym).toBeUndefined();
    expect(await person.repos.groups.mine()).toEqual([]);
  });

  it('gives the first claimant no more power than anyone else', async () => {
    const t = backend();
    const gymId = await seedGym(t);
    const first = await signIn(t, 'first@example.com');
    const other = await signIn(t, 'other@example.com');
    const { group } = await first.repos.gyms.claim({ gymId, joinGroup: true });
    if (!group) throw new Error('expected a group');

    await expect(
      first.repos.groups.update(group.id, { name: 'Mine now', isPublic: false }),
    ).rejects.toThrow(/no owner/i);
    await expect(first.repos.groups.remove(group.id)).rejects.toThrow(/cannot be deleted/i);
    await expect(other.repos.groups.join(group.id)).rejects.toThrow(/home gym/i);

    // Leaving is open to everyone, the first claimant included.
    await other.repos.gyms.claim({ gymId, joinGroup: true });
    await first.repos.groups.leave(group.id);
    expect((await first.repos.groups.mine()).map((g) => g.id)).toEqual([]);
    expect((await other.repos.gyms.mine())?.group?.memberCount).toBe(1);
    expect((await first.repos.gyms.mine())?.gym.id).toBe(gymId);
  });

  it('keeps the group when the account whose claim created it is deleted', async () => {
    const t = backend();
    const gymId = await seedGym(t);
    const first = await signIn(t, 'first@example.com');
    const other = await signIn(t, 'other@example.com');
    const { group } = await first.repos.gyms.claim({ gymId, joinGroup: true });
    await other.repos.gyms.claim({ gymId, joinGroup: true });

    expect(await first.as.mutation(api.account.deleteAccount, {})).toEqual({ done: true });

    const remaining = await other.repos.gyms.mine();
    expect(remaining?.group?.id).toBe(group?.id);
    expect(remaining?.group?.memberCount).toBe(1);
    expect(await t.run(async (ctx) => ctx.db.query('fitnessGroups').collect())).toHaveLength(1);
  });

  it('lists only public profiles to members, counts everyone, and stays out of discovery', async () => {
    const t = backend();
    const gymId = await seedGym(t);
    const open = await signIn(t, 'open@example.com', 'Open Person');
    const closed = await signIn(t, 'closed@example.com', 'Closed Person');
    const stranger = await signIn(t, 'stranger@example.com');
    await open.repos.profile.update({ handle: 'open_person', isPublic: true });
    await closed.repos.profile.update({ handle: 'closed_person', isPublic: false });

    const { group } = await open.repos.gyms.claim({ gymId, joinGroup: true });
    await closed.repos.gyms.claim({ gymId, joinGroup: true });
    if (!group) throw new Error('expected a group');

    const seen = await open.repos.groups.members(group.id);
    expect(seen.total).toBe(2);
    expect(seen.members.map((m) => m.handle)).toEqual(['open_person']);
    expect(seen.members[0]).toMatchObject({
      isYou: true,
      status: 'member',
      votes: 0,
      canVote: false,
    });
    for (const row of seen.members) {
      expect(row).not.toHaveProperty('voterUserId');
      expect(row).not.toHaveProperty('role');
    }

    // A private member still sees the list, and themself in it.
    const fromClosed = await closed.repos.groups.members(group.id);
    expect(fromClosed.members.map((m) => m.handle).sort()).toEqual([
      'closed_person',
      'open_person',
    ]);

    await expect(stranger.repos.groups.members(group.id)).rejects.toThrow(/not available/i);
    expect((await stranger.repos.groups.discover()).groups).toEqual([]);

    const page = await stranger.as.query(api.profiles.byHandle, { handle: 'open_person' });
    expect(page?.profile.homeGym?.name).toBe("Gold's Gym Venice");
  });

  it('refuses every write without a session', async () => {
    const t = backend();
    const gymId = await seedGym(t);
    await expect(t.mutation(api.gyms.claim, { gymId, joinGroup: true })).rejects.toThrow(
      /not signed in/i,
    );
    await expect(t.query(api.gyms.mine, {})).rejects.toThrow(/not signed in/i);
  });
});
