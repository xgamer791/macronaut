import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { canUseAiFoodScanByProfile } from '../../convex/lib/aiScanAccess';
import { useRepos } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { keys } from '@/state/queries';

/** Named preview accounts skip the key gate immediately. Everyone else
 * follows the server roster (current users frozen; new sign-ups blocked). */
export function useAiScanAllowed(): boolean {
  const { food } = useRepos();
  const { user } = useAuth();
  const server = useQuery({
    queryKey: keys.aiScanAvailable,
    queryFn: () => food.aiScanAvailable(),
  });

  useEffect(() => {
    void food.ensureAiScanRoster().then(() => {
      void server.refetch();
    });
    // Freeze once per mount; food/server identities are stable for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food]);

  if (canUseAiFoodScanByProfile({ email: user?.email, name: user?.name })) return true;
  return server.data === true;
}
