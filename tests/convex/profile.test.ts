import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import {
  firstFreeHandle,
  handleSeed,
  isValidHandle,
  normalizeHandle,
} from '../../convex/lib/handles';
import { backend, signIn, tick, type Backend } from './helpers';

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

  it('persists likes and comments and removes them with the post', async () => {
    const t = backend();
    const owner = await signIn(t, 'owner@example.com', 'Owner');
    const reader = await signIn(t, 'reader@example.com', 'Reader');
    await owner.repos.profile.update({ handle: 'owner', isPublic: true });
    await reader.repos.profile.update({ handle: 'reader', isPublic: true });
    const post = await owner.repos.profile.addPost('A public post');

    expect(post).toMatchObject({ likeCount: 0, likedByMe: false, commentCount: 0 });
    await reader.repos.profile.setPostLike(post.id, true);
    await reader.repos.profile.setPostLike(post.id, true);
    const comment = await reader.repos.profile.addPostComment(post.id, '  Great work  ');

    expect(comment.body).toBe('Great work');
    expect(await reader.repos.profile.postThread(post.id)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
      commentCount: 1,
      comments: [{ body: 'Great work', authorName: 'Reader', isMine: true }],
    });
    expect((await owner.repos.profile.myPosts())[0]).toMatchObject({
      likeCount: 1,
      likedByMe: false,
      commentCount: 1,
    });

    await reader.repos.account.deleteAllData();
    expect((await owner.repos.profile.myPosts())[0]).toMatchObject({
      likeCount: 0,
      commentCount: 0,
    });

    await reader.repos.profile.setPostLike(post.id, true);
    const secondComment = await reader.repos.profile.addPostComment(post.id, 'Still great');
    await owner.repos.profile.removePostComment(secondComment.id);
    expect(await owner.repos.profile.postThread(post.id)).toMatchObject({ commentCount: 0 });
    await owner.repos.profile.removePost(post.id);
    expect(await t.run(async (ctx) => ctx.db.query('profilePostLikes').collect())).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query('profilePostComments').collect())).toEqual([]);
  });
});

describe('friends feed', () => {
  it('returns mutual friends only, newest first, in pages of ten', async () => {
    const t = backend();
    const viewer = await signIn(t, 'viewer@example.com', 'Viewer');
    const friend = await signIn(t, 'friend@example.com', 'Fast Friend');
    const pending = await signIn(t, 'pending@example.com', 'Pending Person');
    const stranger = await signIn(t, 'stranger@example.com', 'Stranger');

    await viewer.repos.profile.update({ handle: 'viewer', isPublic: true });
    await friend.repos.profile.update({
      handle: 'fast_friend',
      displayName: 'Fast Friend',
      isPublic: true,
    });
    await pending.repos.profile.update({ handle: 'pending', isPublic: true });
    await stranger.repos.profile.update({ handle: 'stranger', isPublic: true });

    await viewer.repos.profile.setFollow('fast_friend', true);
    await friend.repos.profile.setFollow('viewer', true);
    // A private page stays closed, but a verified friend can still receive
    // the posts explicitly shared through their friends feed.
    await friend.repos.profile.update({ isPublic: false });
    // A one-way request is not a friendship and must not enter the feed.
    await viewer.repos.profile.setFollow('pending', true);

    await viewer.repos.profile.addPost('My own post');
    await pending.repos.profile.addPost('Pending request post');
    await stranger.repos.profile.addPost('Stranger post');
    for (let index = 1; index <= 12; index += 1) {
      await tick();
      await friend.repos.profile.addPost(`Friend post ${index}`);
    }

    const first = await viewer.repos.profile.friendsFeed(null);
    expect(first.page).toHaveLength(10);
    expect(first.isDone).toBe(false);
    expect(first.page[0]).toMatchObject({
      body: 'Friend post 12',
      author: {
        handle: 'fast_friend',
        displayName: 'Fast Friend',
        canOpenProfile: false,
      },
    });
    expect(first.page.every((post) => post.author.id === (friend.userId as string))).toBe(true);

    const second = await viewer.repos.profile.friendsFeed(first.continueCursor);
    expect(second.page.map((post) => post.body)).toEqual(['Friend post 2', 'Friend post 1']);
    expect(second.isDone).toBe(true);
  });

  it('is empty without mutual friends and refuses signed-out reads', async () => {
    const t = backend();
    const viewer = await signIn(t, 'viewer@example.com');
    expect(await viewer.repos.profile.friendsFeed(null)).toEqual({
      page: [],
      isDone: true,
      continueCursor: '',
    });
    await expect(t.query(api.profiles.friendsFeed, { cursor: null })).rejects.toThrow(
      /not signed in/i,
    );
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
    await expect(t.mutation(api.profiles.setFollow, { handle: 'x', follow: true })).rejects.toThrow(
      /not signed in/i,
    );
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

describe('profile follows', () => {
  it('counts followers and following on both pages, and is idempotent', async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');
    const c = await signIn(t, 'c@example.com');

    await a.repos.profile.update({ handle: 'alice', isPublic: true });
    await b.repos.profile.update({ handle: 'bob', isPublic: true });

    expect((await a.repos.profile.me()).followerCount).toBe(0);
    expect((await a.repos.profile.me()).followingCount).toBe(0);

    const after = await b.repos.profile.setFollow('alice', true);
    expect(after.isFollowing).toBe(true);
    expect(after.followerCount).toBe(1);
    expect(after.followingCount).toBe(0);

    // Following twice does not double-count.
    await b.repos.profile.setFollow('alice', true);
    await c.repos.profile.setFollow('alice', true);
    await a.repos.profile.setFollow('bob', true);

    const alice = await a.repos.profile.me();
    expect(alice.followerCount).toBe(2);
    expect(alice.followingCount).toBe(1);
    expect(alice.isFollowing).toBe(false);

    const bobAsA = await a.repos.profile.byHandle('bob');
    expect(bobAsA?.profile.isFollowing).toBe(true);
    expect(bobAsA?.profile.followerCount).toBe(1);

    await b.repos.profile.setFollow('alice', false);
    expect((await a.repos.profile.me()).followerCount).toBe(1);
    expect((await b.repos.profile.byHandle('alice'))?.profile.isFollowing).toBe(false);
  });

  it('refuses a missing handle and following yourself', async () => {
    const t = backend();
    const b = await signIn(t, 'b@example.com');
    await b.repos.profile.update({ handle: 'bob', isPublic: true });

    await expect(b.repos.profile.setFollow('nobody', true)).rejects.toThrow(/not available/i);
    await expect(b.repos.profile.setFollow('bob', true)).rejects.toThrow(/not available/i);

    expect(await t.run(async (ctx) => ctx.db.query('profileFollows').collect())).toEqual([]);
  });

  /** Every account starts private, so refusing to friend a private page would
   * leave the whole friend-then-message flow unusable by default. Naming the
   * exact handle is the request; it still does not open the page. */
  it('accepts a friend request to a private profile without revealing the page', async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');
    await a.repos.profile.update({
      handle: 'alice',
      displayName: 'Alice Runner',
      bio: 'Marathon training block',
      location: 'Austin',
      isPublic: false,
    });
    await b.repos.profile.update({ handle: 'bob', isPublic: true });

    const after = await b.repos.profile.setFollow('alice', true);
    expect(after).toMatchObject({ handle: 'alice', isFollowing: true, followerCount: 1 });
    expect(after.bio).toBeUndefined();
    expect(after.location).toBeUndefined();
    expect(after.bannerUrl).toBeUndefined();

    // The page itself is no more readable than it was before the follow.
    expect(await b.repos.profile.byHandle('alice')).toBeNull();
  });

  it("cannot be written on someone else's behalf, and is erased with the account", async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');
    const c = await signIn(t, 'c@example.com');
    await a.repos.profile.update({ handle: 'alice', isPublic: true });
    await b.repos.profile.update({ handle: 'bob', isPublic: true });
    await c.repos.profile.update({ handle: 'cara', isPublic: true });

    await b.repos.profile.setFollow('alice', true);
    await a.repos.profile.setFollow('cara', true);

    await a.repos.account.deleteAllData();
    const remaining = await t.run(async (ctx) => ctx.db.query('profileFollows').collect());
    expect(remaining).toHaveLength(0);
    expect(await b.repos.profile.byHandle('alice')).toBeNull();
    expect((await c.repos.profile.me()).followerCount).toBe(0);
  });
});

describe('profile connections', () => {
  /** Alice is followed by Bob and Cara, follows Bob and Dan back, so Bob is
   * her only friend. Every list below is read against that shape. */
  async function graph() {
    const t = backend();
    const a = await signIn(t, 'a@example.com', 'Alice Runner');
    const b = await signIn(t, 'b@example.com', 'Bob Stone');
    const c = await signIn(t, 'c@example.com', 'Cara Wells');
    const d = await signIn(t, 'd@example.com', 'Dan Pike');

    await a.repos.profile.update({ handle: 'alice', displayName: 'Alice Runner', isPublic: true });
    await b.repos.profile.update({ handle: 'bob', displayName: 'Bob Stone', isPublic: true });
    await c.repos.profile.update({ handle: 'cara', displayName: 'Cara Wells', isPublic: true });
    await d.repos.profile.update({ handle: 'dan', displayName: 'Dan Pike', isPublic: true });

    await b.repos.profile.setFollow('alice', true);
    await c.repos.profile.setFollow('alice', true);
    await a.repos.profile.setFollow('bob', true);
    await a.repos.profile.setFollow('dan', true);
    return { t, a, b, c, d };
  }

  const names = (people: { displayName: string }[]) => people.map((person) => person.displayName);

  it('lists followers, following and the mutual follows that are friends', async () => {
    const { a } = await graph();

    const followers = await a.repos.profile.connections({ tab: 'followers' });
    expect(followers?.subject).toEqual({ handle: 'alice', displayName: 'Alice Runner' });
    expect(followers?.counts).toEqual({ followers: 2, following: 2, friends: 1 });
    expect(names(followers!.people)).toEqual(['Bob Stone', 'Cara Wells']);

    const following = await a.repos.profile.connections({ tab: 'following' });
    expect(names(following!.people)).toEqual(['Bob Stone', 'Dan Pike']);

    // A friend is a follow that goes both ways: Cara only follows, Dan is
    // only followed, so neither is one.
    const friends = await a.repos.profile.connections({ tab: 'friends' });
    expect(names(friends!.people)).toEqual(['Bob Stone']);
    // All three counts come back whichever tab was asked for.
    expect(friends?.counts).toEqual({ followers: 2, following: 2, friends: 1 });
  });

  it('labels every row with where the viewer stands, and marks their own', async () => {
    const { a, c } = await graph();

    const mine = await a.repos.profile.connections({ tab: 'followers' });
    expect(mine!.people.map((person) => [person.displayName, person.friendship])).toEqual([
      ['Bob Stone', 'friends'],
      ['Cara Wells', 'incoming'],
    ]);
    expect(mine!.people.every((person) => person.isYou)).toBe(false);

    // Cara reads Alice's page, and finds herself in it with nothing to do.
    const theirs = await c.repos.profile.connections({ handle: 'alice', tab: 'followers' });
    const cara = theirs!.people.find((person) => person.handle === 'cara');
    expect(cara?.isYou).toBe(true);
    expect(theirs!.people.find((person) => person.handle === 'bob')?.friendship).toBe('none');
  });

  it('searches the whole list by name and by handle, @ or not', async () => {
    const { a } = await graph();
    const search = async (term: string) =>
      names((await a.repos.profile.connections({ tab: 'following', search: term }))!.people);

    expect(await search('bob')).toEqual(['Bob Stone']);
    expect(await search('  STONE ')).toEqual(['Bob Stone']);
    expect(await search('@dan')).toEqual(['Dan Pike']);
    expect(await search('nobody')).toEqual([]);
    // A search never changes the counts the tabs are labelled with.
    const narrowed = await a.repos.profile.connections({ tab: 'following', search: 'bob' });
    expect(narrowed?.counts).toEqual({ followers: 2, following: 2, friends: 1 });
  });

  it('never finds anyone by their email address', async () => {
    const { a } = await graph();
    const found = await a.repos.profile.connections({ tab: 'following', search: 'b@example.com' });
    expect(found?.people).toEqual([]);
  });

  it('answers a private page the same way a handle nobody owns is answered', async () => {
    const { t, a, b } = await graph();
    expect(
      (await b.repos.profile.connections({ handle: 'alice', tab: 'followers' }))?.counts,
    ).toEqual({ followers: 2, following: 2, friends: 1 });

    await a.repos.profile.update({ isPublic: false });
    expect(await b.repos.profile.connections({ handle: 'alice', tab: 'followers' })).toBeNull();
    expect(await b.repos.profile.connections({ handle: 'nobody', tab: 'followers' })).toBeNull();
    // The owner still reads their own lists on a page nobody else may open.
    expect(
      (await a.repos.profile.connections({ handle: 'alice', tab: 'followers' }))?.people,
    ).toHaveLength(2);

    // Signed out, a public page's lists open and a private one's do not.
    await a.repos.profile.update({ isPublic: true });
    expect(
      (await t.query(api.profiles.connections, { handle: 'alice', tab: 'followers' }))?.counts
        .followers,
    ).toBe(2);
    // With no session nobody has any standing with anybody.
    const anonymous = await t.query(api.profiles.connections, {
      handle: 'alice',
      tab: 'followers',
    });
    expect(anonymous!.people.every((person) => person.friendship === 'none')).toBe(true);
    expect(anonymous!.people.every((person) => person.isYou === false)).toBe(true);

    // Your own lists need a session, since there is no page to name.
    expect(await t.query(api.profiles.connections, { tab: 'followers' })).toBeNull();
  });

  it('reports the mutual follow the profile page needs to offer a message', async () => {
    const { a, b, c } = await graph();

    const bobAsAlice = (await a.repos.profile.byHandle('bob'))!.profile;
    expect(bobAsAlice.isFollowing).toBe(true);
    expect(bobAsAlice.isFollowedBy).toBe(true);

    // Cara follows Alice and is not followed back.
    const aliceAsCara = (await c.repos.profile.byHandle('alice'))!.profile;
    expect(aliceAsCara.isFollowing).toBe(true);
    expect(aliceAsCara.isFollowedBy).toBe(false);

    // Your own page never claims you follow yourself.
    const own = await b.repos.profile.me();
    expect(own.isFollowing).toBe(false);
    expect(own.isFollowedBy).toBe(false);
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
