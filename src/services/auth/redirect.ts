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
