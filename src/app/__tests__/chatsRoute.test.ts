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

  it('puts chats after notifications on Today and before notifications on profiles', () => {
    const appHeader = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'AppHeader.tsx'),
      'utf8',
    );
    const homeCluster = appHeader.slice(appHeader.indexOf('<HeaderAvatarButton'));
    expect(homeCluster.indexOf('<HeaderNotifyButton')).toBeLessThan(
      homeCluster.indexOf('<HeaderChatsButton'),
    );
    expect(appHeader).toContain('accessibilityLabel="Open chats"');
    expect(appHeader).toContain("router.push(signedIn ? '/chats' : '/login')");

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
    // A private profile answers to its whole handle, and nothing less.
    expect(backend).toContain('function matchesSearch');
    expect(backend).toContain('if (!profile.isPublic) return profile.handleLower === wanted;');
    expect(backend).not.toContain('!profile.isPublic || profile.userId === userId');
    expect(profiles).not.toContain('row.userId === userId || !row.isPublic');
  });
});
