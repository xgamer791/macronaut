import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const readApp = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('notification center', () => {
  it('registers the route and opens it from the header bell', () => {
    expect(readApp('_layout.tsx')).toContain('name="notifications"');
    const tabBar = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'TabBar.tsx'), 'utf8');
    expect(tabBar).not.toContain('useNotifications');
    expect(tabBar).not.toContain("href: '/notifications'");
    expect(tabBar).toContain("href: '/groups'");
    expect(tabBar).toContain('people-circle-outline');
    expect(tabBar).toContain('router.push(item.href)');
    const header = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'AppHeader.tsx'), 'utf8');
    expect(header).toContain('<HeaderNotifyButton iconColor={icon} />');
    expect(header).toContain("router.push(signedIn ? '/notifications' : '/login')");
    expect(header.indexOf('Open calendar')).toBeLessThan(header.indexOf('<HeaderNotifyButton'));
  });

  it('shows themed unread and earlier sections with useful destinations', () => {
    const page = readApp('notifications.tsx');
    expect(page).toContain('NEW');
    expect(page).toContain('EARLIER');
    expect(page).toContain('Mark all notifications as read');
    expect(page).toContain('colors.accent');
    expect(page).toContain("pathname: '/chat/[id]'");
    expect(page).toContain('router.push(`/u/${item.actor.handle}`)');
    expect(page).not.toContain('initialMode="light"');
  });

  it('packs the list down so more of it reaches the screen', () => {
    const page = readApp('notifications.tsx');
    // The message runs on from the title rather than claiming a line of its
    // own, and the pair is cut at two lines.
    expect(page).toContain('<AppText numberOfLines={2} style={styles.message}>');
    expect(page).toContain('{`  ${item.body}`}');
    // Three quarters, so the turn happens clear of the timestamp.
    expect(page).toContain("width: '75%'");
    expect(page).toContain('minHeight: 68');
    expect(page).not.toContain('minHeight: 92');
    expect(page).toContain('size={42}');
  });

  it('leaves one rule above EARLIER, not a summary bar and its own', () => {
    const page = readApp('notifications.tsx');
    // The bar counted what the NEW and EARLIER labels already say, and its
    // border was the second of two rules stacked on top of each other.
    expect(page).not.toContain('styles.summary');
    expect(page).not.toContain('summaryDot');
    expect(page).not.toContain('feed.data.unreadCount');
    // The empty state is a different thing and stays.
    expect(page).toContain('title="You\'re all caught up"');
  });

  it('creates durable events from follows and messages', () => {
    const profile = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'profiles.ts'), 'utf8');
    const chats = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'chats.ts'), 'utf8');
    const notifications = fs.readFileSync(
      path.join(appDir, '..', '..', 'convex', 'notifications.ts'),
      'utf8',
    );
    expect(profile).toContain('addFriendRequestNotification');
    expect(chats).toContain('addChatNotification');
    expect(chats).toContain('markChatNotificationsRead');
    expect(notifications).toContain("query('notifications')");
    expect(notifications).toContain('requireUserId');
    // Accepting is not silent: the person who asked is told, or the
    // friendship is only ever news to one of the two.
    expect(profile).toContain('addFriendAcceptedNotification');
    expect(notifications).toContain("kind: 'friend_accepted'");
  });

  it('answers a friend request on the row, since the profile page may be private', () => {
    const page = readApp('notifications.tsx');
    const notifications = fs.readFileSync(
      path.join(appDir, '..', '..', 'convex', 'notifications.ts'),
      'utf8',
    );
    // The feed carries where you stand with the actor, so the row knows
    // whether to offer Accept.
    expect(notifications).toContain('friendship: await friendshipWith(ctx, viewerId, actor._id)');
    expect(page).toContain("item.actor.friendship === 'incoming'");
    expect(page).toContain('title="Accept"');
    expect(page).toContain('setFriend.mutateAsync({ userId: item.actor.id, follow: true })');
  });

  it('never keeps a stale bundle talking to a freshly deployed backend', () => {
    const cachebust = fs.readFileSync(
      path.join(appDir, '..', '..', 'scripts', 'patch-pages-cachebust.py'),
      'utf8',
    );
    const deploy = fs.readFileSync(
      path.join(appDir, '..', '..', '.github', 'workflows', 'deploy.yml'),
      'utf8',
    );
    const http = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'http.ts'), 'utf8');
    // Pages caches version.json for ten minutes. The live build id lives on
    // Convex, which can send Cache-Control: no-store.
    expect(http).toContain("path: '/web-build'");
    expect(http).toContain('PUBLIC_WEB_BUILD');
    expect(http).toContain("'Cache-Control': 'no-store, no-cache, must-revalidate'");
    expect(deploy).toContain('npx convex env set PUBLIC_WEB_BUILD');
    expect(deploy).toContain('cancel-in-progress: false');
    expect(cachebust).toContain('/web-build');
    expect(cachebust).toContain("u.searchParams.set('_t', String(Date.now()))");
    // A tab left open never reloaded, so the build check has to run again
    // when it comes back to the front, not only on first paint.
    expect(cachebust).toContain("document.addEventListener('visibilitychange'");
    expect(cachebust).toContain("document.visibilityState==='visible'");
    expect(cachebust).toContain("window.addEventListener('pageshow'");
  });
});
