import { api } from '../../convex/_generated/api';
import { ConvexCaller } from './convexCall';

export interface AccountRepo {
  /** Whether a password account already uses this address, so create-account
   * can say so while it is being typed instead of failing on submit. */
  emailTaken(email: string): Promise<boolean>;
  /** Erase every row the account owns; the account itself stays. */
  deleteAllData(): Promise<void>;
  /** Erase all data, then the sessions, sign-in methods and user record. */
  deleteAccount(): Promise<void>;
}

/** The server deletes in bounded batches; keep calling until it says done. */
const MAX_ROUNDS = 200;

export function createAccountRepo(convex: ConvexCaller): AccountRepo {
  async function drain(run: () => Promise<{ done: boolean }>): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const { done } = await run();
      if (done) return;
    }
    throw new Error('Deleting data took too many rounds; try again.');
  }
  return {
    emailTaken: (email) => convex.query(api.account.passwordAccountExists, { email }),
    deleteAllData: () => drain(() => convex.mutation(api.account.deleteAllData, {})),
    deleteAccount: () => drain(() => convex.mutation(api.account.deleteAccount, {})),
  };
}
