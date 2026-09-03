import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { canUseAiFoodScanByProfile } from '../../convex/lib/aiScanAccess';
import { useRepos } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { keys, useSetting } from '@/state/queries';

/** The four current accounts skip the gate via email, name, or the frozen
 * roster. Anyone who signs up after that roster backfill stays locked out. */
export function useAiScanAllowed(): boolean {
  const { food } = useRepos();
  const { user } = useAuth();
  const displayName = useSetting<string>('displayName', '');
  const server = useQuery({
    queryKey: keys.aiScanAvailable,
    queryFn: () => food.aiScanAvailable(),
  });

  useEffect(() => {
    void food.ensureAiScanRoster().then(() => {
      void server.refetch();
    });
    // Freeze/backfill once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food]);

  if (
    canUseAiFoodScanByProfile({
      email: user?.email,
      name: user?.name ?? displayName.data,
    })
  ) {
    return true;
  }
  return server.data === true;
}
