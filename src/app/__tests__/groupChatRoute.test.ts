import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('group chat', () => {
  it('registers one conversation per group that hides the footer under its composer', () => {
    const layout = read('src', 'app', '_layout.tsx');
    expect(layout).toContain('name="group-chat/[id]"');
    expect(layout).toContain("!pathname.startsWith('/group-chat/')");
    // The route is named so it can never swallow /groups.
    expect(fs.existsSync(path.join(root, 'src', 'app', 'group-chat', '[id].tsx'))).toBe(true);

    const route = read('src', 'app', 'group-chat', '[id].tsx');
    expect(route).toContain('useGroupChatThread');
    expect(route).toContain('useMarkGroupChatRead');
    expect(route).toContain('useRemoveGroupMessage');
    // The same list and composer as a direct chat, with every sender named.
    expect(route).toContain('<MessageList');
    expect(route).toContain('showSenderNames');
    expect(route).toContain('<MessageComposer');
    // Outsiders see the group and the way in, never the messages.
    expect(route).toContain('Members can chat');
    expect(route).toContain('Join group');
    expect(route).toContain('Set as my home gym');
    expect(route).toContain('Delete message?');
  });

  it('is reached from Chats, the group sheet and the bell', () => {
    const chats = read('src', 'app', 'chats.tsx');
    expect(chats).toContain('useGroupChats');
    expect(chats).toContain('<GroupIdentity');
    expect(chats).toContain("pathname: '/group-chat/[id]'");

    const groups = read('src', 'app', 'groups.tsx');
    expect(groups).toContain('useGroupChats');
    expect(groups).toContain('onOpenChat');
    expect(groups).toContain("title={unread ? `Group chat · ${unread} new` : 'Group chat'}");
    expect(groups).toContain("pathname: '/group-chat/[id]'");

    const notifications = read('src', 'app', 'notifications.tsx');
    expect(notifications).toContain("item.kind === 'group_message' && item.groupId");
    expect(notifications).toContain("pathname: '/group-chat/[id]'");
  });

  it('is served by members-only functions that keep one bell row per group', () => {
    const backend = read('convex', 'groupChats.ts');
    expect(backend).toContain('requireUserId');
    expect(backend).toContain('membership(');
    expect(backend).toContain("insert('groupMessages'");
    expect(backend).toContain('NOTIFY_MEMBER_CAP');
    expect(backend).toContain('SENDS_PER_MINUTE');
    expect(backend).toContain('upsertGroupMessageNotification');

    const notifications = read('convex', 'notifications.ts');
    expect(notifications).toContain("kind: 'group_message'");
    expect(notifications).toContain('by_recipient_group');

    const repo = read('src', 'repositories', 'groupChatRepo.ts');
    expect(repo).toContain('api.groupChats.thread');
    expect(repo).toContain('api.groupChats.send');
    expect(repo).toContain('api.groupChats.markRead');
    expect(repo).toContain('api.groupChats.remove');
  });
});
