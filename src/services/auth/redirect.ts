/** Convex Auth auto-redeems `?code=` as a sign-in. Password-reset links use
 * a different query (`token`) on `/forgot-password`; never consume `code`
 * there even if one is present, or the token is spent before a password is set. */
export function shouldHandleAuthCodeFromUrl(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  return !path.endsWith('/forgot-password');
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
