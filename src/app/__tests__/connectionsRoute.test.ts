import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const convexDir = path.join(srcDir, '..', 'convex');
const readApp = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');
const readSrc = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

/** The followers / following / friends page, reached by tapping either count
 * under a name on your own profile or on somebody's public one. */
describe('connections route', () => {
  it('registers a full-screen page that slides in from the left', () => {
    expect(fs.existsSync(path.join(appDir, 'connections.tsx'))).toBe(true);
    expect(readApp('_layout.tsx')).toContain('name="connections"');
    const page = readApp('connections.tsx');
    expect(page).toContain('<SlideScreen from="left">');
    expect(page).not.toContain('initialMode="dark"');
  });

  it('opens from the follower and following counts on both profile pages', () => {
    const header = readSrc('ui', 'components', 'ProfileHeader.tsx');
    expect(header).toContain('onOpenFollowers');
    expect(header).toContain('onOpenFollowing');

    const own = readApp('profile.tsx');
    const publicPage = readApp(path.join('u', '[handle].tsx'));
    for (const page of [own, publicPage]) {
      expect(page).toContain("openConnections('followers')");
      expect(page).toContain("openConnections('following')");
      expect(page).toContain("pathname: '/connections'");
    }
    // Someone else's lists are named by their handle; your own has no page to
    // name, so the server resolves the session instead.
    expect(publicPage).toContain('handle: profile.handle, tab');
    expect(own).toContain('params: { tab }');
  });

  it('puts the three tabs above a search box that reaches the server', () => {
    const page = readApp('connections.tsx');
    for (const tab of ['Followers', 'Following', 'Friends']) {
      expect(page).toContain(`label: '${tab}'`);
    }
    expect(page).toContain('useConnections');
    expect(page).toContain('useDebounced(search)');
    expect(page).toContain('accessibilityLabel="Clear search"');
    expect(page).toContain("outlineStyle: 'none'");

    // The term is part of the query key, so each pause in the typing is its
    // own read, and the previous answer stays put while the next one lands.
    const queries = readSrc('state', 'queries.ts');
    expect(queries).toContain("['connections', handle, tab, search]");
    expect(queries).toContain('placeholderData: (previous) => previous');
    expect(queries).toContain("qc.invalidateQueries({ queryKey: ['connections'] })");
  });

  it('searches on the server so it looks past the page that arrived', () => {
    const backend = fs.readFileSync(path.join(convexDir, 'profiles.ts'), 'utf8');
    expect(backend).toContain('export const connections = query');
    // One shared answer to what a friend is and who a search term reaches.
    expect(backend).toContain("from './chats';");
    expect(backend).toContain('identity');
    expect(backend).toContain('matchesSearch');
    expect(backend).toContain('profileFor');
    expect(backend).toContain('if (wanted && !matchesSearch(user, profile, wanted)) continue;');
    // A private page and a handle nobody owns are the same answer.
    expect(backend).toContain('const readable = await readableProfile(ctx, handle);');
    expect(backend).toContain('if (!readable) return null;');
  });

  it('offers each row the one action their friendship permits, and none on your own', () => {
    const page = readApp('connections.tsx');
    expect(page).toContain('<ChatPersonRow');
    expect(page).toContain('showAction={!person.isYou}');
    expect(page).toContain("if (person.friendship !== 'friends') return;");

    const row = readSrc('ui', 'components', 'ChatPersonRow.tsx');
    expect(row).toContain('showAction = true');
    expect(row).toContain('{showAction ? (');
  });

  it('puts Message beside Follow on one line, split evenly', () => {
    const publicPage = readApp(path.join('u', '[handle].tsx'));
    expect(publicPage).toContain('styles.actionRow');
    expect(publicPage).toContain('title="Message"');
    expect(publicPage).toContain('style={styles.actionButton}');
    // Same row, equal widths, one gap between them.
    const row = publicPage.slice(publicPage.indexOf('  actionRow: {'));
    expect(row).toContain("flexDirection: 'row'");
    expect(row).toContain('gap: spacing.md');
    expect(row).toContain('flex: 1');
    expect(row).toContain('flexBasis: 0');
    // Follow is still the one primary action; Message never outranks it.
    expect(publicPage).toContain('variant="secondary"');
  });

  it('waits on the mutual follow before a message can be sent', () => {
    const publicPage = readApp(path.join('u', '[handle].tsx'));
    expect(publicPage).toContain('profile.isFollowing && profile.isFollowedBy');
    expect(publicPage).toContain('once they follow you back');

    // The page carries a handle and never an account id, so that is how it
    // names who to open a chat with.
    expect(publicPage).toContain('openChat.mutateAsync({ handle: profile.handle })');
    const repo = readSrc('repositories', 'chatRepo.ts');
    expect(repo).toContain('openByHandle(handle: string)');
    const backend = fs.readFileSync(path.join(convexDir, 'chats.ts'), 'utf8');
    expect(backend).toContain('async function userForHandle');
    // Friends only is still decided on the server, however the target is named.
    expect(backend).toContain('You must be friends before starting a chat');
  });
});
