import { useQuery } from '@tanstack/react-query';
import { canUseAiFoodScan } from '../../convex/lib/aiScanAccess';
import { useRepos } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { keys } from '@/state/queries';

/** Those two preview emails always skip the key gate on the client.
 * The server still enforces the same list when the photo is analyzed. */
export function useAiScanAllowed(): boolean {
  const { food } = useRepos();
  const { user } = useAuth();
  const server = useQuery({
    queryKey: keys.aiScanAvailable,
    queryFn: () => food.aiScanAvailable(),
  });
  if (canUseAiFoodScan(user?.email)) return true;
  return server.data === true;
}
