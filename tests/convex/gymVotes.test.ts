import { describe, expect, it } from 'vitest';
import { DAY_MS, GYM_VOTE_RULES } from '../../convex/lib/gymVotes';
import { backend, signIn, type Backend } from './helpers';

async function seedGym(t: Backend) {
  return t.run(async (ctx) =>
    ctx.db.insert('gyms', {
      provider: 'google',
      placeId: 'ChIJ-lifetime-austin',
      name: 'Life Time Austin',
      address: '1000 Congress Ave, Austin, TX 78701, USA',
      lat: 30.2747,
      lng: -97.7404,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
}

/** A gym group of `n` accounts; the first is the one everybody votes about. */
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
  const [target, ...voters] = people;
  return { gymId, group, target, voters };
}

const daysFromNow = (iso: string) => (Date.parse(iso) - Date.now()) / DAY_MS;

describe('gym group votes', () => {
  it('suspends at three votes and bans at five, anonymously', async () => {
    const t = backend();
    const { group, target, voters } = await gymGroup(t, 8);

    expect(await voters[0].repos.groups.voteRemove(group.id, target.userId)).toMatchObject({
      votes: 1,
      status: 'member',
      myVote: true,
    });
    // Voting twice counts once.
    expect((await voters[0].repos.groups.voteRemove(group.id, target.userId)).votes).toBe(1);
    expect((await voters[1].repos.groups.voteRemove(group.id, target.userId)).votes).toBe(2);

    let listed = await voters[2].repos.groups.members(group.id);
    let row = listed.members.find((m) => m.handle === 'member_0');
    expect(row).toMatchObject({ status: 'member', votes: 2, myVote: false, canVote: true });
    expect(listed.members.find((m) => m.isYou)?.canVote).toBe(false);
    // Members are named (that is what a member list is); who voted never is.
    const wire = JSON.stringify(listed);
    expect(wire).not.toContain('voterUserId');
    expect(wire).not.toContain('voters');

    // Third vote: suspended, still listed, gym kept.
    expect(await voters[2].repos.groups.voteRemove(group.id, target.userId)).toMatchObject({
      votes: 3,
      status: 'suspended',
    });
    listed = await voters[2].repos.groups.members(group.id);
    expect(listed.total).toBe(7);
    row = listed.members.find((m) => m.handle === 'member_0');
    expect(row).toMatchObject({ status: 'suspended', votes: 3 });
    expect((await target.repos.profile.me()).homeGym?.name).toBe('Life Time Austin');
    const suspended = await target.repos.gyms.mine();
    expect(suspended?.group?.isMember).toBe(false);
    expect(suspended?.restriction?.kind).toBe('suspension');
    expect(daysFromNow(suspended!.restriction!.until)).toBeCloseTo(
      GYM_VOTE_RULES.SUSPENSION_DAYS,
      1,
    );
    await expect(target.repos.gyms.joinGroup()).rejects.toThrow(
      /suspended .* until 20\d\d-\d\d-\d\d/i,
    );

    // A fourth vote changes nothing; the fifth bans.
    expect((await voters[3].repos.groups.voteRemove(group.id, target.userId)).status).toBe(
      'suspended',
    );
    expect(await voters[4].repos.groups.voteRemove(group.id, target.userId)).toMatchObject({
      votes: 0,
      status: 'banned',
      myVote: false,
    });
    const banned = await target.repos.profile.me();
    expect(banned.homeGym).toBeUndefined();
    expect(await target.repos.gyms.mine()).toBeNull();
    listed = await voters[2].repos.groups.members(group.id);
    expect(listed.members.some((m) => m.handle === 'member_0')).toBe(false);
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query('groupVotes')
          .withIndex('by_group_target', (q) => q.eq('groupId', group.id as never))
          .collect(),
      ),
    ).toEqual([]);
    const ban = await t.run(async (ctx) => ctx.db.query('groupBans').collect());
    expect(ban).toHaveLength(1);
    expect(ban[0].kind).toBe('ban');
    expect(daysFromNow(ban[0].until)).toBeCloseTo(GYM_VOTE_RULES.BAN_DAYS, 1);
  });

  it('keeps a banned person out until the date, then lets them back', async () => {
    const t = backend();
    const { gymId, group, target, voters } = await gymGroup(t, 8);
    for (const voter of voters.slice(0, 5)) {
      await voter.repos.groups.voteRemove(group.id, target.userId);
    }

    await expect(target.repos.gyms.claim({ gymId, joinGroup: true })).rejects.toThrow(
      /rejoin after 20\d\d-\d\d-\d\d/,
    );
    // The gym itself can still be set, just not the group.
    const quiet = await target.repos.gyms.claim({ gymId, joinGroup: false });
    expect(quiet.group?.isMember).toBe(false);
    expect(quiet.restriction?.kind).toBe('ban');

    await t.run(async (ctx) => {
      const [row] = await ctx.db.query('groupBans').collect();
      await ctx.db.patch(row._id, { until: new Date(Date.now() - DAY_MS).toISOString() });
    });
    const back = await target.repos.gyms.joinGroup();
    expect(back.isMember).toBe(true);
    expect(await t.run(async (ctx) => ctx.db.query('groupBans').collect())).toEqual([]);
  });

  it('restores a suspended member once the suspension lapses', async () => {
    const t = backend();
    const { group, target, voters } = await gymGroup(t, 8);
    for (const voter of voters.slice(0, 3)) {
      await voter.repos.groups.voteRemove(group.id, target.userId);
    }
    expect((await target.repos.gyms.mine())?.restriction?.kind).toBe('suspension');

    await t.run(async (ctx) => {
      const [row] = await ctx.db.query('groupBans').collect();
      await ctx.db.patch(row._id, { until: new Date(Date.now() - 1000).toISOString() });
    });
    expect((await target.repos.gyms.joinGroup()).isMember).toBe(true);
    expect((await target.repos.gyms.mine())?.restriction).toBeNull();
  });

  it('ignores votes older than the window', async () => {
    const t = backend();
    const { group, target, voters } = await gymGroup(t, 8);
    await voters[0].repos.groups.voteRemove(group.id, target.userId);
    await voters[1].repos.groups.voteRemove(group.id, target.userId);
    await t.run(async (ctx) => {
      const stale = new Date(Date.now() - (GYM_VOTE_RULES.VOTE_WINDOW_DAYS + 1) * DAY_MS);
      for (const vote of await ctx.db.query('groupVotes').collect()) {
        await ctx.db.patch(vote._id, { createdAt: stale.toISOString() });
      }
    });
    expect(await voters[2].repos.groups.voteRemove(group.id, target.userId)).toMatchObject({
      votes: 1,
      status: 'member',
    });
    expect(await t.run(async (ctx) => ctx.db.query('groupVotes').collect())).toHaveLength(1);
  });

  it('will not count votes in a group too small to be fair', async () => {
    const t = backend();
    const { group, target, voters } = await gymGroup(t, 5);
    await expect(voters[0].repos.groups.voteRemove(group.id, target.userId)).rejects.toThrow(
      /at least 6 other members/i,
    );
  });

  it('refuses self-votes, non-members, ordinary groups, and clears votes when the target leaves', async () => {
    const t = backend();
    const { group, target, voters } = await gymGroup(t, 8);
    await expect(target.repos.groups.voteRemove(group.id, target.userId)).rejects.toThrow(
      /yourself/i,
    );
    const outsider = await signIn(t, 'outsider@example.com');
    await expect(outsider.repos.groups.voteRemove(group.id, target.userId)).rejects.toThrow(
      /not available/i,
    );
    const ordinary = await voters[0].repos.groups.create({ name: 'Run club' });
    await expect(voters[0].repos.groups.voteRemove(ordinary.id, target.userId)).rejects.toThrow(
      /only gym groups/i,
    );

    await voters[0].repos.groups.voteRemove(group.id, target.userId);
    await voters[1].repos.groups.voteRemove(group.id, target.userId);
    expect((await voters[1].repos.groups.retractVote(group.id, target.userId)).votes).toBe(1);

    await target.repos.groups.leave(group.id);
    expect(await t.run(async (ctx) => ctx.db.query('groupVotes').collect())).toEqual([]);
    await expect(voters[0].repos.groups.voteRemove(group.id, target.userId)).rejects.toThrow(
      /not in this group/i,
    );
  });
});
