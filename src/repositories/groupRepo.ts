import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { clean, ConvexCaller } from './convexCall';

export interface FitnessGroup {
  id: string;
  name: string;
  handle: string;
  sport?: string;
  location?: string;
  description?: string;
  isPublic: boolean;
  memberCount: number;
  isOwner: boolean;
  isMember: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupDiscovery {
  groups: FitnessGroup[];
  viewerLocation?: string;
  viewerSport?: string;
}

export interface GroupList {
  isOwner: boolean;
  groups: FitnessGroup[];
}

export interface NewGroup {
  name: string;
  sport?: string;
  location?: string;
  description?: string;
  isPublic?: boolean;
}

export interface GroupRepo {
  mine(): Promise<FitnessGroup[]>;
  discover(): Promise<GroupDiscovery>;
  forHandle(handle: string): Promise<GroupList | null>;
  create(input: NewGroup): Promise<FitnessGroup>;
  update(id: string, input: NewGroup): Promise<FitnessGroup>;
  join(id: string): Promise<FitnessGroup>;
  leave(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const groupId = (id: string) => id as Id<'fitnessGroups'>;

export function createGroupRepo(convex: ConvexCaller): GroupRepo {
  return {
    mine: () => convex.query(api.groups.mine, {}),
    discover: () => convex.query(api.groups.discover, {}),
    forHandle: (handle) => convex.query(api.groups.forHandle, { handle }),
    create: (input) => convex.mutation(api.groups.create, clean(input)),
    update: (id, input) => convex.mutation(api.groups.update, { id: groupId(id), ...clean(input) }),
    join: (id) => convex.mutation(api.groups.join, { id: groupId(id) }),
    async leave(id) {
      await convex.mutation(api.groups.leave, { id: groupId(id) });
    },
    async remove(id) {
      await convex.mutation(api.groups.remove, { id: groupId(id) });
    },
  };
}
