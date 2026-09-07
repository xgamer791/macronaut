import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const readApp = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('chat routes', () => {
  it('registers the chat list, new-chat picker and conversation screen', () => {
    const layout = readApp('_layout.tsx');
    expect(layout).toContain('name="chats"');
    expect(layout).toContain('name="new-chat"');
    expect(layout).toContain('name="chat/[id]"');
    expect(fs.existsSync(path.join(appDir, 'chats.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'new-chat.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'chat', '[id].tsx'))).toBe(true);
  });

  it('opens chats from the tab bar, while notifications remain on profiles and the header', () => {
    const tabBar = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'TabBar.tsx'), 'utf8');
    expect(tabBar).toContain("href: '/chats'");
    expect(tabBar).toContain('router.push(item.href)');
    expect(tabBar.indexOf("href: '/chats'")).toBeLessThan(tabBar.indexOf("href: '/groups'"));
    expect(tabBar).not.toContain("href: '/notifications'");

    const appHeader = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'AppHeader.tsx'),
      'utf8',
    );
    expect(appHeader).not.toContain('<HeaderChatsButton');
    expect(appHeader).not.toContain('<HeaderAvatarButton');
    expect(appHeader).toContain('<HeaderNotifyButton iconColor={icon} />');

    const profileHeader = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'ProfileHeader.tsx'),
      'utf8',
    );
    const profileMenu = profileHeader.slice(profileHeader.indexOf('styles.menu'));
    expect(profileMenu.indexOf('<HeaderChatsButton')).toBeLessThan(
      profileMenu.indexOf('<HeaderNotifyButton'),
    );
  });

  it('keeps a plus action and searches contacts and Macronaut people', () => {
    const chats = readApp('chats.tsx');
    const picker = readApp('new-chat.tsx');
    const thread = readApp(path.join('chat', '[id].tsx'));
    expect(chats).toContain('Start a new chat');
    expect(chats).toContain('name="add"');
    expect(picker).toContain('Search people on Macronaut');
    expect(picker).toContain('CONTACTS');
    expect(picker).toContain('PEOPLE ON MACRONAUT');
    expect(picker).toContain('ChatPeopleList');
    // The Chats search box looks past your own threads into the database.
    expect(chats).toContain('Search chats and people on Macronaut');
    expect(chats).toContain('ChatPeopleList');
    expect(chats).toContain('PEOPLE ON MACRONAUT');
    expect(chats).not.toContain('initialMode="light"');
    expect(picker).not.toContain('initialMode="light"');
    expect(thread).not.toContain('initialMode="light"');
    expect(chats).toContain("outlineStyle: 'none'");
    expect(picker).toContain("outlineStyle: 'none'");
    expect(thread).toContain("outlineStyle: 'none'");
  });

  it('uses database-backed chat repositories and message routes', () => {
    const repo = fs.readFileSync(path.join(srcDir, 'repositories', 'chatRepo.ts'), 'utf8');
    const backend = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'chats.ts'), 'utf8');
    expect(repo).toContain('api.chats.list');
    expect(repo).toContain('api.chats.send');
    expect(backend).toContain("query('directChats')");
    expect(backend).toContain("insert('chatMessages'");
    expect(backend).toContain('requireUserId');
    expect(backend).toContain('friendshipState');
    expect(backend).toContain('You must be friends before starting a chat');
    expect(backend).toContain('You must be friends before sending a message');
  });

  it('finds people through one shared list that always offers the friend gate', () => {
    const list = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'ChatPeopleList.tsx'),
      'utf8',
    );
    expect(list).toContain('useChatPeople');
    expect(list).toContain('useSetProfileFollow');
    expect(list).toContain('useOpenChat');
    // Messaging is unreachable until the follow is mutual.
    expect(list).toContain("if (person.friendship !== 'friends') return;");

    const row = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'ChatPersonRow.tsx'), 'utf8');
    for (const action of ['Message', 'Accept', 'Requested', 'Add friend']) {
      expect(row).toContain(action);
    }
  });

  it('does not gate finding or befriending someone on their page being public', () => {
    const backend = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'chats.ts'), 'utf8');
    const profiles = fs.readFileSync(
      path.join(appDir, '..', '..', 'convex', 'profiles.ts'),
      'utf8',
    );
    // Searching reads the accounts table itself — every account, whether or
    // not it has a profile row — and matches a name or a handle. `isPublic`
    // decides who may read a profile page, never who may be found.
    expect(backend).toContain("ctx.db.query('users').collect()");
    expect(backend).toContain('function matchesSearch');
    expect(backend).toContain("(user.name ?? '').toLowerCase().includes(wanted)");
    expect(backend).not.toContain('profile.isPublic &&');
    expect(profiles).not.toContain('row.userId === userId || !row.isPublic');
    // Your own account, under any sign-up, is never a search result.
    expect(backend).toContain('function samePerson');
    // Friend and chat actions address the account id, so a person with no
    // handle yet can still be befriended and messaged.
    expect(backend).toContain("args: { userId: v.id('users') }");
    expect(profiles).toContain("userId: v.optional(v.id('users'))");
  });

  it('claims a profile row for every signed-in account, so search can see it', () => {
    const profiles = fs.readFileSync(
      path.join(appDir, '..', '..', 'convex', 'profiles.ts'),
      'utf8',
    );
    const repo = fs.readFileSync(path.join(srcDir, 'repositories', 'profileRepo.ts'), 'utf8');
    const layout = readApp('_layout.tsx');
    expect(profiles).toContain('export const ensure = mutation');
    expect(repo).toContain('api.profiles.ensure');
    // Opening the app is enough — no profile edit required to be findable.
    expect(layout).toContain('profile.ensure()');
    expect(layout).toContain('if (!signedIn || claimed.current) return;');
  });
});
