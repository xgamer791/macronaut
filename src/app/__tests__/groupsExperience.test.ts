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
});
