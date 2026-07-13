import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/** Static rendering serves 'light'; the client re-reads the real scheme after
 * hydration. useSyncExternalStore gives us that without setState-in-effect. */
export function useColorScheme() {
  return useSyncExternalStore(
    (onChange) => {
      const sub = Appearance.addChangeListener(onChange);
      return () => sub.remove();
    },
    () => Appearance.getColorScheme() ?? 'light',
    () => 'light' as const,
  );
}
