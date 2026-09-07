import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');

describe('groups experience', () => {
  const groups = fs.readFileSync(path.join(appDir, 'groups.tsx'), 'utf8');
  const repo = fs.readFileSync(path.join(srcDir, 'repositories', 'groupRepo.ts'), 'utf8');
  const backend = fs.readFileSync(path.join(appDir, '..', '..', 'convex', 'groups.ts'), 'utf8');

  it('offers the requested discovery and management destinations', () => {
    for (const label of ['For you', 'Yours', 'Discover', 'Manage']) {
      expect(groups).toContain(`label: '${label}'`);
    }
    expect(groups).toContain('Recommended for you');
    expect(groups).toContain('Closest to you');
    expect(groups).toContain('Search groups');
    expect(groups).toContain('Groups you manage');
    expect(groups).toContain('Edit details, visibility, and community location');
  });

  it('supports local-first discovery and complete membership actions', () => {
    expect(repo).toContain('discover(): Promise<GroupDiscovery>');
    expect(repo).toContain('update(id: string, input: NewGroup)');
    expect(backend).toContain('function proximity(');
    expect(backend).toContain("ctx.db.query('fitnessGroups').collect()");
    expect(backend).toContain('!memberOf.has');
    expect(backend).toContain('proximity(a.location, viewerLocation)');
    expect(groups).toContain('useJoinGroup');
    expect(groups).toContain('useLeaveGroup');
    expect(groups).toContain('useDeleteGroup');
    expect(groups).toContain('Delete this group for every member?');
  });

  it('carries the home gym: a card, its one group, the member list, and the vote', () => {
    expect(groups).toContain('title="Your gym"');
    expect(groups).toContain('useMyGym');
    expect(groups).toContain('useJoinGymGroup');
    expect(groups).toContain("group.kind === 'gym' ? 'Home gym'");
    expect(groups).toContain('Set as my home gym');
    // Members are listed only to members; the vote is quiet text, no danger colour on the row.
    expect(groups).toContain('useGroupMembers');
    expect(groups).toContain('Vote to remove');
    expect(groups).toContain('useVoteRemove');
    expect(groups).toContain('useRetractVote');
    expect(groups).toContain('Votes are anonymous');
    // A gym group is never edited, never joined by button, and never discovered.
    expect(backend).toContain("group.kind !== 'gym'");
    expect(backend).toContain('export const members');
    expect(backend).toContain('export const voteRemove');
    expect(backend).toContain(
      "throw new ConvexError('Gym groups have no owner and cannot be edited')",
    );
  });
});
