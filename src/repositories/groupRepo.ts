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
  /** 'gym' marks a gym's one shared group: no owner, joined by claiming the gym. */
  kind?: 'gym';
  gymId?: string;
  memberCount: number;
  isOwner: boolean;
  isMember: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Someone in a group, as its members see them. Only public profiles are
 * listed; the counts include everyone. */
export interface GroupMember {
  id: string;
  handle: string | null;
  displayName: string;
  avatarUrl?: string;
  friendship: 'none' | 'outgoing' | 'incoming' | 'friends';
  primarySport?: string;
  isYou: boolean;
  status: 'member' | 'suspended';
  /** Votes to remove them this week. Never who cast them. */
  votes: number;
  myVote: boolean;
  canVote: boolean;
}

export interface GroupMembers {
  total: number;
  listed: number;
  members: GroupMember[];
}

export interface VoteResult {
  votes: number;
  status: 'member' | 'suspended' | 'banned';
  myVote: boolean;
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
  members(id: string): Promise<GroupMembers>;
  voteRemove(id: string, targetUserId: string): Promise<VoteResult>;
  retractVote(id: string, targetUserId: string): Promise<VoteResult>;
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
    members: (id) => convex.query(api.groups.members, { id: groupId(id) }),
    voteRemove: (id, targetUserId) =>
      convex.mutation(api.groups.voteRemove, {
        id: groupId(id),
        targetUserId: targetUserId as Id<'users'>,
      }),
    retractVote: (id, targetUserId) =>
      convex.mutation(api.groups.retractVote, {
        id: groupId(id),
        targetUserId: targetUserId as Id<'users'>,
      }),
  };
}
