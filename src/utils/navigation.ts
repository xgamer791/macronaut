import { useRouter } from 'expo-router';

type RouterLike = ReturnType<typeof useRouter>;

/** Go back if there's history; otherwise land on the Today tab. Deep links
 * (web refresh, direct URL) open screens with no stack behind them. */
export function goBackOrHome(router: RouterLike): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
