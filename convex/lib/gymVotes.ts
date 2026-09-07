/** The rules a gym group removes a member by. A gym group has no owner, so
 * removal is a vote of the members: three within a week suspends, five bans.
 * Everything tunable lives here; the mutations in convex/groups.ts only apply
 * it. Pure, so the client can label "2 of 5" from the same numbers. */

export const GYM_VOTE_RULES = {
  /** Distinct members whose votes suspend the target. */
  SUSPEND_VOTES: 3,
  /** Distinct members whose votes ban the target. */
  BAN_VOTES: 5,
  /** A vote counts for this long, then drops off on its own. */
  VOTE_WINDOW_DAYS: 7,
  SUSPENSION_DAYS: 7,
  BAN_DAYS: 30,
  /** No vote counts until the group has this many members besides the target,
   * so two friends can never gang up on a third in a tiny group. */
  MIN_OTHER_MEMBERS: 6,
} as const;

export const DAY_MS = 86_400_000;

export interface VoteLike {
  voterUserId: string;
  createdAt: string;
}

export function isVoteActive(vote: VoteLike, nowMs: number): boolean {
  const cast = Date.parse(vote.createdAt);
  return Number.isFinite(cast) && nowMs - cast <= GYM_VOTE_RULES.VOTE_WINDOW_DAYS * DAY_MS;
}

export function distinctActiveVoters(votes: VoteLike[], nowMs: number): number {
  const voters = new Set<string>();
  for (const vote of votes) if (isVoteActive(vote, nowMs)) voters.add(vote.voterUserId);
  return voters.size;
}

export type VoteOutcome = 'none' | 'suspend' | 'ban';

/** What a tally means. A member already suspended is not suspended again by
 * the same three votes; only reaching the ban tier changes anything. */
export function outcomeFor(distinct: number, currentlySuspended: boolean): VoteOutcome {
  if (distinct >= GYM_VOTE_RULES.BAN_VOTES) return 'ban';
  if (distinct >= GYM_VOTE_RULES.SUSPEND_VOTES && !currentlySuspended) return 'suspend';
  return 'none';
}

export function untilIso(nowMs: number, days: number): string {
  return new Date(nowMs + days * DAY_MS).toISOString();
}

/** Whether a suspension or ban row is still in force. */
export function isRestricted(row: { until: string } | null | undefined, nowMs: number): boolean {
  if (!row) return false;
  const until = Date.parse(row.until);
  return Number.isFinite(until) && until > nowMs;
}

/** The date a restriction lifts, for an error message. Plain ISO date rather
 * than Intl, which the Convex runtime does not format consistently. */
export function untilLabel(until: string): string {
  return until.slice(0, 10);
}

/** The next tier a target's tally is counting toward. */
export function nextThreshold(status: 'member' | 'suspended'): number {
  return status === 'suspended' ? GYM_VOTE_RULES.BAN_VOTES : GYM_VOTE_RULES.SUSPEND_VOTES;
}
