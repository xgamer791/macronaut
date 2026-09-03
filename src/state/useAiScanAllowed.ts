import { useQuery } from '@tanstack/react-query';
import { canUseAiFoodScan } from '../../convex/lib/aiScanAccess';
import { useRepos } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { keys } from '@/state/queries';

/** Server allow-list is authoritative. Fall back to the signed-in email
 * while that query loads so the two preview accounts are not greyed out. */
export function useAiScanAllowed(): boolean {
  const { food } = useRepos();
  const { user } = useAuth();
  const server = useQuery({
    queryKey: keys.aiScanAvailable,
    queryFn: () => food.aiScanAvailable(),
  });
  if (typeof server.data === 'boolean') return server.data;
  return canUseAiFoodScan(user?.email);
}
