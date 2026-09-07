import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const readApp = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('notification center', () => {
  it('registers the route and opens it from the tab bar bell', () => {
    expect(readApp('_layout.tsx')).toContain('name="notifications"');
    const tabBar = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'TabBar.tsx'), 'utf8');
    expect(tabBar).toContain('useNotifications');
    expect(tabBar).toContain("href: '/notifications'");
    expect(tabBar).toContain('router.push(item.href)');
    expect(tabBar).toContain('notifications-outline');
    expect(tabBar).toContain('palette.accentDark');
    const header = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'AppHeader.tsx'), 'utf8');
    expect(header).not.toContain('<HeaderNotifyButton');
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
    // A tab left open never reloaded, so the build check has to run again
    // when it comes back to the front, not only on first paint.
    expect(cachebust).toContain("document.addEventListener('visibilitychange'");
    expect(cachebust).toContain("document.visibilityState==='visible'");
  });
});
