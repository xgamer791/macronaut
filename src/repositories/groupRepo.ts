import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { clean, ConvexCaller } from './convexCall';

export interface FitnessGroup {
  id: string;
  name: string;
  handle: string;
  sport?: string;
  description?: string;
  isPublic: boolean;
  memberCount: number;
  isOwner: boolean;
  isMember: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupList {
  isOwner: boolean;
  groups: FitnessGroup[];
}

export interface NewGroup {
  name: string;
  sport?: string;
  description?: string;
  isPublic?: boolean;
}

export interface GroupRepo {
  mine(): Promise<FitnessGroup[]>;
  forHandle(handle: string): Promise<GroupList | null>;
  create(input: NewGroup): Promise<FitnessGroup>;
  join(id: string): Promise<FitnessGroup>;
  leave(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const groupId = (id: string) => id as Id<'fitnessGroups'>;

export function createGroupRepo(convex: ConvexCaller): GroupRepo {
  return {
    mine: () => convex.query(api.groups.mine, {}),
    forHandle: (handle) => convex.query(api.groups.forHandle, { handle }),
    create: (input) => convex.mutation(api.groups.create, clean(input)),
    join: (id) => convex.mutation(api.groups.join, { id: groupId(id) }),
    async leave(id) {
      await convex.mutation(api.groups.leave, { id: groupId(id) });
    },
    async remove(id) {
      await convex.mutation(api.groups.remove, { id: groupId(id) });
    },
  };
}
