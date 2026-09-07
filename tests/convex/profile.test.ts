import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import {
  firstFreeHandle,
  handleSeed,
  isValidHandle,
  normalizeHandle,
} from '../../convex/lib/handles';
import { backend, signIn, type Backend } from './helpers';

/** Put a file in storage without going through an upload URL: convex-test has
 * no HTTP endpoint to POST to, and what the mutations care about is the id. */
async function storedImage(t: Backend, body = 'jpeg-bytes'): Promise<string> {
  return t.run(async (ctx) => ctx.storage.store(new Blob([body], { type: 'image/jpeg' })));
}

describe('profile handles', () => {
  it('reduces anything to letters, numbers and underscores', () => {
    expect(normalizeHandle('  Chris Garcia ')).toBe('chris_garcia');
    expect(normalizeHandle('Chris--@--Garcia')).toBe('chris_garcia');
    expect(normalizeHandle('___chris___')).toBe('chris');
    expect(normalizeHandle('!!!')).toBe('');
    expect(normalizeHandle('a'.repeat(40))).toHaveLength(24);
  });

  it('accepts only handles that survive normalizing and are long enough', () => {
    expect(isValidHandle('chris_garcia')).toBe(true);
    expect(isValidHandle('ab')).toBe(false);
    expect(isValidHandle('Chris')).toBe(false);
    expect(isValidHandle('chris garcia')).toBe(false);
  });

  it('seeds from the name, then the email, then a generic stem', () => {
    expect(handleSeed('Chris Garcia', 'x@example.com')).toBe('chris_garcia');
    expect(handleSeed(undefined, 'runner42@example.com')).toBe('runner42');
    expect(handleSeed('', '')).toBe('athlete');
    // Too short to stand alone, so it is padded rather than rejected.
    expect(handleSeed('Al', undefined)).toBe('al_athlete');
  });

  it('appends a counter until the handle is free, staying inside the limit', async () => {
    const taken = new Set(['runner', 'runner_2']);
    expect(await firstFreeHandle('runner', async (c) => taken.has(c))).toBe('runner_3');
    const long = 'a'.repeat(24);
    const chosen = await firstFreeHandle(long, async (c) => c === long);
    expect(chosen).toHaveLength(24);
    expect(chosen.endsWith('_2')).toBe(true);
  });
});

describe('own profile', () => {
  it('reads as a placeholder before anything is saved, then persists', async () => {
    const t = backend();
    const { repos, userId } = await signIn(t, 'chris@example.com');
    await t.run(async (ctx) => ctx.db.patch(userId, { name: 'Chris Garcia' }));

    const before = await repos.profile.me();
    expect(before.saved).toBe(false);
    expect(before.id).toBeNull();
    expect(before.handle).toBe('chris_garcia');
    expect(before.isPublic).toBe(false);
    // Nothing was written just by looking.
    expect(await t.run(async (ctx) => ctx.db.query('profiles').collect())).toEqual([]);

    const saved = await repos.profile.update({ bio: '  Marathon training  ' });
    expect(saved.saved).toBe(true);
    expect(saved.id).not.toBeNull();
    expect(saved.bio).toBe('Marathon training');
    expect(saved.handle).toBe('chris_garcia');

    const again = await repos.profile.me();
    expect(again.bio).toBe('Marathon training');
    expect(again.saved).toBe(true);
    // Editing twice reuses the one row rather than making another.
    await repos.profile.update({ location: 'San Luis Obispo' });
    expect(await t.run(async (ctx) => ctx.db.query('profiles').collect())).toHaveLength(1);
  });

  it('caps free text and mirrors the display name onto the account', async () => {
    const { repos } = await signIn(backend());
    const saved = await repos.profile.update({
      displayName: 'D'.repeat(200),
      bio: 'B'.repeat(400),
      location: 'L'.repeat(200),
      primarySport: 'S'.repeat(100),
    });
    expect(saved.displayName).toHaveLength(60);
    expect(saved.bio).toHaveLength(280);
    expect(saved.location).toHaveLength(60);
    expect(saved.primarySport).toHaveLength(40);

    const t2 = backend();
    const second = await signIn(t2, 'other@example.com');
    await second.repos.profile.update({ displayName: 'Alex Stone' });
    const user = await t2.run(async (ctx) => ctx.db.get(second.userId));
    expect(user?.name).toBe('Alex Stone');
  });

  it('validates handles and refuses one another account already has', async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');

    await a.repos.profile.update({ handle: 'Speedy Runner' });
    expect((await a.repos.profile.me()).handle).toBe('speedy_runner');

    await expect(b.repos.profile.update({ handle: 'speedy_runner' })).rejects.toThrow(/taken/i);
    await expect(b.repos.profile.update({ handle: 'ab' })).rejects.toThrow(/3-24/);
    await expect(b.repos.profile.update({ handle: '!!!' })).rejects.toThrow(/3-24/);

    // Re-saving your own handle is not a collision with yourself.
    await expect(a.repos.profile.update({ handle: 'speedy_runner' })).resolves.toMatchObject({
      handle: 'speedy_runner',
    });
  });
});

describe('profile images', () => {
  it('resolves stored files to URLs and deletes the one it replaces', async () => {
    const t = backend();
    const { repos, userId } = await signIn(t);

    const first = await storedImage(t, 'first');
    const withAvatar = await repos.profile.setImage('avatar', first);
    expect(withAvatar.avatarUrl).toBeTruthy();
    // The header avatar reads users.image, so it follows the profile picture.
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.image).toBe(withAvatar.avatarUrl);

    const second = await storedImage(t, 'second');
    await repos.profile.setImage('avatar', second);
    const files = await t.run(async (ctx) => ctx.db.system.query('_storage').collect());
    expect(files.map((f) => f._id)).toEqual([second]);

    const banner = await storedImage(t, 'banner');
    const withBanner = await repos.profile.setImage('banner', banner);
    expect(withBanner.bannerUrl).toBeTruthy();
    expect(withBanner.avatarUrl).toBeTruthy();

    const cleared = await repos.profile.setImage('avatar', null);
    expect(cleared.avatarUrl).toBeUndefined();
    expect(cleared.bannerUrl).toBeTruthy();
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.image).toBeUndefined();
  });
});

describe('profile posts', () => {
  it('adds, edits, counts and removes posts newest first', async () => {
    const t = backend();
    const { repos } = await signIn(t);
    expect(await repos.profile.myPosts()).toEqual([]);

    const first = await repos.profile.addPost('  Ran the long loop  ');
    expect(first.body).toBe('Ran the long loop');
    // Posting is enough to create the profile; there is no separate setup step.
    expect((await repos.profile.me()).saved).toBe(true);

    const second = await repos.profile.addPost('Rest day');
    expect((await repos.profile.myPosts()).map((p) => p.body)).toEqual([
      'Rest day',
      'Ran the long loop',
    ]);
    expect((await repos.profile.me()).postCount).toBe(2);

    const edited = await repos.profile.updatePost(first.id, 'Ran the long loop, felt easy');
    expect(edited.body).toBe('Ran the long loop, felt easy');

    await repos.profile.removePost(second.id);
    expect((await repos.profile.myPosts()).map((p) => p.body)).toEqual([
      'Ran the long loop, felt easy',
    ]);
    expect((await repos.profile.me()).postCount).toBe(1);
  });

  it('needs words or a photo, and keeps a photo-only post', async () => {
    const t = backend();
    const { repos } = await signIn(t);
    await expect(repos.profile.addPost('   ')).rejects.toThrow(/words or a photo/i);

    const image = await storedImage(t);
    const post = await repos.profile.addPost('', image);
    expect(post.body).toBe('');
    expect(post.imageUrl).toBeTruthy();
    // Blanking the words is allowed while the photo carries the post.
    await expect(repos.profile.updatePost(post.id, '  ')).resolves.toMatchObject({ body: '' });

    // Deleting the post takes its photo with it.
    await repos.profile.removePost(post.id);
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toEqual([]);
  });

  it('caps a post body', async () => {
    const { repos } = await signIn(backend());
    const post = await repos.profile.addPost('x'.repeat(4000));
    expect(post.body).toHaveLength(1000);
  });
});

describe('profile visibility', () => {
  it('hides a private profile from everyone but its owner', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');

    await owner.repos.profile.update({ handle: 'owner_one', bio: 'Private thoughts' });
    await owner.repos.profile.addPost('Private post');

    // The owner can always open their own page by handle.
    const asOwner = await owner.repos.profile.byHandle('owner_one');
    expect(asOwner?.profile.isOwner).toBe(true);
    expect(asOwner?.posts).toHaveLength(1);

    expect(await stranger.repos.profile.byHandle('owner_one')).toBeNull();
    // And with no session at all.
    expect(await t.query(api.profiles.byHandle, { handle: 'owner_one' })).toBeNull();
  });

  it('shares the profile and its posts once it is public', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const stranger = await signIn(t, 'stranger@example.com');
    await owner.repos.profile.update({
      handle: 'owner_one',
      displayName: 'Owner One',
      bio: 'Marathon training',
      isPublic: true,
    });
    await owner.repos.profile.addPost('Public post');

    const seen = await stranger.repos.profile.byHandle('OWNER_ONE');
    expect(seen?.profile.displayName).toBe('Owner One');
    expect(seen?.profile.bio).toBe('Marathon training');
    expect(seen?.profile.isOwner).toBe(false);
    expect(seen?.posts.map((p) => p.body)).toEqual(['Public post']);

    // Signed out sees the same public page.
    const anonymous = await t.query(api.profiles.byHandle, { handle: 'owner_one' });
    expect(anonymous?.profile.handle).toBe('owner_one');

    // A public page never carries the row's ownership or storage ids.
    expect(Object.keys(seen?.profile ?? {})).not.toContain('userId');
    expect(Object.keys(seen?.profile ?? {})).not.toContain('avatarId');

    // Flipping the toggle back closes it again immediately.
    await owner.repos.profile.update({ isPublic: false });
    expect(await stranger.repos.profile.byHandle('owner_one')).toBeNull();
  });

  it('answers a handle nobody owns the same way as a private one', async () => {
    const t = backend();
    const { repos } = await signIn(t);
    expect(await repos.profile.byHandle('nobody_here')).toBeNull();
    expect(await repos.profile.byHandle('')).toBeNull();
    expect(await repos.profile.byHandle('!!!')).toBeNull();
  });

  it('refuses every profile write without a session', async () => {
    const t = backend();
    await expect(t.query(api.profiles.me, {})).rejects.toThrow(/not signed in/i);
    await expect(t.query(api.profiles.myPosts, {})).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.profiles.update, { bio: 'x' })).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.profiles.generateUploadUrl, {})).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.profiles.addPost, { body: 'x' })).rejects.toThrow(/not signed in/i);
  });

  it("keeps one account out of another account's posts", async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');
    const mine = await a.repos.profile.addPost('Mine');

    expect(await b.repos.profile.myPosts()).toEqual([]);
    await expect(b.repos.profile.updatePost(mine.id, 'Hijacked')).rejects.toThrow();
    await b.repos.profile.removePost(mine.id);
    expect((await a.repos.profile.myPosts()).map((p) => p.body)).toEqual(['Mine']);
  });
});

describe('deleting an account', () => {
  it('takes the profile, the posts and their stored images with it', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com');
    const other = await signIn(t, 'other@example.com');

    await owner.repos.profile.setImage('avatar', await storedImage(t, 'avatar'));
    await owner.repos.profile.setImage('banner', await storedImage(t, 'banner'));
    await owner.repos.profile.addPost('With photo', await storedImage(t, 'post'));
    const keptFile = await storedImage(t, 'theirs');
    await other.repos.profile.setImage('avatar', keptFile);

    await owner.repos.account.deleteAllData();

    expect(await owner.repos.profile.myPosts()).toEqual([]);
    expect((await owner.repos.profile.me()).saved).toBe(false);
    const files = await t.run(async (ctx) => ctx.db.system.query('_storage').collect());
    expect(files.map((f) => f._id)).toEqual([keptFile]);

    // The other account is untouched.
    expect((await other.repos.profile.me()).avatarUrl).toBeTruthy();
  });
});
