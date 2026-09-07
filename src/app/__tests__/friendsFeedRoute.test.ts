import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');

describe('friends feed', () => {
  it('opens from the tab bar as a left-sliding stack page', () => {
    const page = path.join(appDir, 'friends.tsx');
    const root = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');
    const tabs = fs.readFileSync(path.join(appDir, '(tabs)', '_layout.tsx'), 'utf8');
    const tabBar = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'TabBar.tsx'), 'utf8');
    const friendsItem = tabBar.slice(
      tabBar.indexOf("href: '/friends'"),
      tabBar.indexOf("href: '/groups'"),
    );

    expect(fs.existsSync(page)).toBe(true);
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'friends.tsx'))).toBe(false);
    expect(root).toContain('name="friends" options={SLIDE_OVER_OPTIONS}');
    expect(tabs).not.toContain('name="friends"');
    expect(friendsItem).toContain("label: 'Friends'");
    expect(friendsItem).toContain('icon: Users');
    expect(friendsItem).not.toContain('comingSoon: true');
    expect(fs.readFileSync(page, 'utf8')).toContain('<SlideScreen from="left">');
  });

  it('loads the database feed ten at a time as the list reaches the bottom', () => {
    const page = fs.readFileSync(path.join(appDir, 'friends.tsx'), 'utf8');
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
    const page = fs.readFileSync(path.join(appDir, 'friends.tsx'), 'utf8');
    const backend = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'profiles.ts'), 'utf8');

    expect(backend).toContain("withIndex('by_user'");
    expect(backend).toContain("withIndex('by_followee'");
    expect(backend).toContain('incomingIds.has');
    expect(page).toContain('backgroundColor: colors.surfaceRaised');
    expect(page).toContain('backgroundColor: colors.track');
    expect(page).toContain('color={colors.accent}');
    expect(page).not.toContain('initialMode="light"');
    expect(page).not.toContain('#1877F2');
  });

  it('uses an edge-to-edge feed instead of rounded post cards', () => {
    const page = fs.readFileSync(path.join(appDir, 'friends.tsx'), 'utf8');

    expect(page).toContain('function FriendsFeedPostView');
    expect(page).toContain('styles.postImage');
    expect(page).toContain('borderBottomWidth: StyleSheet.hairlineWidth');
    expect(page).toContain('maxWidth: MAX_FEED_WIDTH');
    expect(page).not.toContain('styles.card');
    expect(page).not.toContain('styles.profileAction');
    expect(page).not.toContain('View profile');
  });

  it('keeps the find-friends action inside safe header chrome', () => {
    const page = fs.readFileSync(path.join(appDir, 'friends.tsx'), 'utf8');

    expect(page).toContain('safeTop={false}');
    expect(page).toContain('collapseHeader={false}');
    expect(page).toContain('<GlassHeaderBar inset={spacing.lg}>');
    expect(page).toContain('accessibilityLabel="Find friends"');
    expect(page).toContain('height: touchTarget');
  });
});
