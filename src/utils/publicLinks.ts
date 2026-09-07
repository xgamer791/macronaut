/** Public URLs for a profile page and a single wall photo. Native builds
 * point at the GitHub Pages origin; the web build uses the tab it is in. */

export function publicSiteBase(): string {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`;
  }
  return 'https://xgamer791.github.io/macronaut';
}

export function profileShareUrl(handle: string): string {
  return `${publicSiteBase()}/u/${handle}`;
}

export function profilePostShareUrl(handle: string, postId: string): string {
  return `${profileShareUrl(handle)}?post=${encodeURIComponent(postId)}`;
}

export function photoShareUrl(handle: string | undefined, photoId: string): string {
  const base = publicSiteBase();
  if (handle) {
    return `${base}/photos?handle=${encodeURIComponent(handle)}&photo=${encodeURIComponent(photoId)}`;
  }
  return `${base}/photos?photo=${encodeURIComponent(photoId)}`;
}
