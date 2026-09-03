import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Web builds can be served from a sub-path (GitHub Pages serves the app from
 * /macronaut/), and `Linking.createURL` on web resolves against the origin
 * only, so it would hand back the bare host and send the provider's redirect
 * to the wrong site. Build the URL from the same base path the bundle was
 * exported with. */
export function webRedirectUrl(origin: string, basePath: string | undefined): string {
  const base = (basePath ?? '').trim().replace(/^\/*/, '/').replace(/\/+$/, '');
  return `${origin.replace(/\/+$/, '')}${base === '/' ? '' : base}/`;
}

/** Turn a browser path (optionally including the static-export base) into the
 * path Expo Router expects. Convex Auth's default `history.replaceState` does
 * not update Expo Router, which can leave `?code=` in the route and wipe a
 * valid session the next time the app opens. */
export function expoRouterPathFromLocationUrl(
  relativeUrl: string,
  basePath: string | undefined,
): string {
  const base = (basePath ?? '').trim().replace(/^\/*/, '/').replace(/\/+$/, '');
  const prefix = base === '/' ? '' : base;
  let path = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
  if (prefix) {
    if (path === prefix) return '/';
    if (path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
    else if (path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`)) {
      path = `/${path.slice(prefix.length)}`;
    }
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return path || '/';
}

/** Where Google sends the user back after consent. Convex Auth only honours
 * destinations its `redirect` callback allows (convex/auth.ts): the deployed
 * site, the app's own `macronaut://` scheme, and local development URLs. */
export function authRedirectUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return '';
    return webRedirectUrl(window.location.origin, process.env.EXPO_PUBLIC_BASE_PATH);
  }
  return Linking.createURL('/');
}
