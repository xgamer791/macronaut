import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { auth } from './auth';

const http = httpRouter();

// /api/auth/signin/*, /api/auth/callback/* — the OAuth round trip runs on the
// Convex site URL, so no provider secret ever reaches the app bundle.
auth.addHttpRoutes(http);

/** Live Pages build id. GitHub Pages caches version.json for ten minutes, so
 * the site asks here (no-store) whether a newer shell exists. */
http.route({
  path: '/web-build',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ build: process.env.PUBLIC_WEB_BUILD ?? '' }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

export default http;
