import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { EmailAvailability } from '@/domain/signupCredentials';
import { isPlausibleEmail, normalizeEmail } from '@/services/auth/email';
import { useRepos } from '@/state/AppProvider';
import { keys } from '@/state/queries';

/** Keystrokes are cheap; round trips are not. */
export const EMAIL_CHECK_DEBOUNCE_MS = 400;

/** A Convex client with no connection queues the call rather than failing it,
 * which would leave Create Account disabled for as long as the network is
 * down. Give up instead and let the sign-up call be the one to refuse. */
export const EMAIL_CHECK_TIMEOUT_MS = 6_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Email check timed out')), ms);
  });
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

/** Watches the create-account address and reports whether Macronaut already
 * has an account on it, so the form can say so before the whole thing is
 * filled in. */
export function useEmailAvailability(email: string): EmailAvailability {
  const { account } = useRepos();
  const address = normalizeEmail(email);
  const worthAsking = isPlausibleEmail(address);
  const [settled, setSettled] = useState('');

  useEffect(() => {
    if (!worthAsking) return;
    const timer = setTimeout(() => setSettled(address), EMAIL_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [address, worthAsking]);

  const asked = settled === address && worthAsking;
  const taken = useQuery({
    queryKey: keys.emailTaken(settled),
    queryFn: () => withTimeout(account.emailTaken(settled), EMAIL_CHECK_TIMEOUT_MS),
    enabled: asked,
    retry: false,
    // The answer only changes when someone else takes the address mid-signup,
    // which the create call catches anyway.
    staleTime: 30_000,
  });

  if (!worthAsking) return 'idle';
  if (!asked || taken.isPending || taken.isFetching) return 'checking';
  if (taken.isError) return 'unknown';
  return taken.data ? 'taken' : 'available';
}
