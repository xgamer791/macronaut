import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, signIn, type Backend } from './helpers';

async function storedImage(t: Backend, body = 'jpeg'): Promise<string> {
  return t.run(async (ctx) => ctx.storage.store(new Blob([body], { type: 'image/jpeg' })));
}

describe('photo wall', () => {
  it('adds photos to the owner wall and hides private ones from strangers', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await owner.repos.profile.update({ handle: 'owner_one', isPublic: true });

    const pub = await owner.repos.photos.add(await storedImage(t, 'pub'), 'Sunrise', true);
    const priv = await owner.repos.photos.add(await storedImage(t, 'priv'), 'Private set', false);
    expect(pub.caption).toBe('Sunrise');
    expect((await owner.repos.photos.mine()).map((p) => p.caption)).toEqual(['Private set', 'Sunrise']);

    const wall = await stranger.repos.photos.forHandle('owner_one');
    expect(wall?.isOwner).toBe(false);
    expect(wall?.photos.map((p) => p.caption)).toEqual(['Sunrise']);

    await owner.repos.photos.setPublic(priv.id, true);
    expect((await stranger.repos.photos.forHandle('owner_one'))?.photos).toHaveLength(2);

    await owner.repos.photos.remove(pub.id);
    expect((await owner.repos.photos.mine()).map((p) => p.caption)).toEqual(['Private set']);
    const files = await t.run(async (ctx) => ctx.db.system.query('_storage').collect());
    expect(files).toHaveLength(1);
  });

  it('does not show a private profile wall, and refuses unsigned writes', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await owner.repos.profile.update({ handle: 'owner_one', isPublic: false });
    await owner.repos.photos.add(await storedImage(t), 'Hidden', true);

    expect(await stranger.repos.photos.forHandle('owner_one')).toBeNull();
    expect(await t.query(api.photos.forHandle, { handle: 'owner_one' })).toBeNull();
    await expect(t.query(api.photos.mine, {})).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.groups.create, { name: 'Nope' })).rejects.toThrow(/not signed in/i);
  });
});

describe('fitness groups', () => {
  it('creates a group, lists it on the profile, and lets another account join', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await owner.repos.profile.update({ handle: 'owner_one', isPublic: true });

    const group = await owner.repos.groups.create({
      name: '  Morning miles  ',
      sport: 'Running',
      description: 'Saturday long run',
    });
    expect(group.name).toBe('Morning miles');
    expect(group.isOwner).toBe(true);
    expect(group.isMember).toBe(true);
    expect(group.memberCount).toBe(1);
    expect(group.handle).toBe('morning_miles');

    const mine = await owner.repos.groups.mine();
    expect(mine.map((g) => g.name)).toEqual(['Morning miles']);

    const publicList = await stranger.repos.groups.forHandle('owner_one');
    expect(publicList?.groups).toHaveLength(1);
    expect(publicList?.groups[0]?.isMember).toBe(false);

    const joined = await stranger.repos.groups.join(group.id);
    expect(joined.isMember).toBe(true);
    expect(joined.memberCount).toBe(2);
    expect((await owner.repos.groups.mine())[0]?.memberCount).toBe(2);

    await stranger.repos.groups.leave(group.id);
    expect((await owner.repos.groups.mine())[0]?.memberCount).toBe(1);
  });

  it('hides private groups from strangers and refuses joining a private group', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await owner.repos.profile.update({ handle: 'owner_one', isPublic: true });
    const hidden = await owner.repos.groups.create({ name: 'Inner circle', isPublic: false });
    await owner.repos.groups.create({ name: 'Open miles', isPublic: true });

    const seen = await stranger.repos.groups.forHandle('owner_one');
    expect(seen?.groups.map((g) => g.name)).toEqual(['Open miles']);
    await expect(stranger.repos.groups.join(hidden.id)).rejects.toThrow(/not available/i);

    await owner.repos.profile.update({ isPublic: false });
    expect(await stranger.repos.groups.forHandle('owner_one')).toBeNull();
  });

  it('only the owner can delete, and they cannot leave', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await owner.repos.profile.update({ handle: 'owner_one', isPublic: true });
    const group = await owner.repos.groups.create({ name: 'Club' });
    await stranger.repos.groups.join(group.id);

    await expect(owner.repos.groups.leave(group.id)).rejects.toThrow(/delete the group/i);
    await stranger.repos.groups.remove(group.id);
    expect(await owner.repos.groups.mine()).toHaveLength(1);

    await owner.repos.groups.remove(group.id);
    expect(await owner.repos.groups.mine()).toEqual([]);
    expect(await stranger.repos.groups.mine()).toEqual([]);
  });

  it('deleting an account takes owned groups, memberships and wall photos', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const other = await signIn(t, 'other@example.com');
    await owner.repos.profile.update({ handle: 'owner_one', isPublic: true });
    await other.repos.profile.update({ handle: 'other_one', isPublic: true });
    await owner.repos.photos.add(await storedImage(t, 'wall'));
    const group = await owner.repos.groups.create({ name: 'Club' });
    await other.repos.groups.join(group.id);
    const kept = await other.repos.groups.create({ name: 'Kept' });

    await owner.repos.account.deleteAllData();
    expect(await owner.repos.photos.mine()).toEqual([]);
    expect(await owner.repos.groups.mine()).toEqual([]);
    expect(await other.repos.groups.mine().then((g) => g.map((x) => x.name))).toEqual(['Kept']);
    expect(await t.run(async (ctx) => ctx.db.query('fitnessGroups').collect())).toHaveLength(1);
    expect((await t.run(async (ctx) => ctx.db.query('fitnessGroups').collect()))[0]?._id).toBe(kept.id);
  });
});
