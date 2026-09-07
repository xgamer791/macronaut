import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');

describe('friends feed', () => {
  it('opens the people tab as Friends instead of a disabled placeholder', () => {
    const page = path.join(appDir, '(tabs)', 'friends.tsx');
    const layout = fs.readFileSync(path.join(appDir, '(tabs)', '_layout.tsx'), 'utf8');
    const tabBar = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'TabBar.tsx'), 'utf8');
    const friendsItem = tabBar.slice(
      tabBar.indexOf("name: 'friends'"),
      tabBar.indexOf("href: '/notifications'"),
    );

    expect(fs.existsSync(page)).toBe(true);
    expect(layout).toContain('<Tabs.Screen name="friends" />');
    expect(friendsItem).toContain("label: 'Friends'");
    expect(friendsItem).toContain("icon: 'people-outline'");
    expect(friendsItem).not.toContain('comingSoon: true');
  });

  it('loads the database feed ten at a time as the list reaches the bottom', () => {
    const page = fs.readFileSync(path.join(appDir, '(tabs)', 'friends.tsx'), 'utf8');
    const query = fs.readFileSync(path.join(srcDir, 'state', 'queries.ts'), 'utf8');
    const repo = fs.readFileSync(path.join(srcDir, 'repositories', 'profileRepo.ts'), 'utf8');
    const backend = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'profiles.ts'), 'utf8');

    expect(page).toContain('useFriendsFeed');
    expect(page).toContain('onEndReached');
    expect(page).toContain('feed.fetchNextPage()');
    expect(page).toContain('feed.hasNextPage && !feed.isFetchingNextPage');
    expect(query).toContain('useInfiniteQuery');
    expect(repo).toContain('api.profiles.friendsFeed');
    expect(backend).toContain('FRIENDS_FEED_PAGE_SIZE = 10');
    expect(backend).toContain('numItems: FRIENDS_FEED_PAGE_SIZE');
    expect(backend).toContain('.paginate({ cursor, numItems: FRIENDS_FEED_PAGE_SIZE })');
  });

  it('uses mutual friends only and keeps the feed in the app theme', () => {
    const page = fs.readFileSync(path.join(appDir, '(tabs)', 'friends.tsx'), 'utf8');
    const backend = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'profiles.ts'), 'utf8');

    expect(backend).toContain("withIndex('by_user'");
    expect(backend).toContain("withIndex('by_followee'");
    expect(backend).toContain('incomingIds.has');
    expect(page).toContain('backgroundColor: colors.surface');
    expect(page).toContain('color={colors.accent}');
    expect(page).not.toContain('initialMode="light"');
    expect(page).not.toContain('#1877F2');
  });
});
