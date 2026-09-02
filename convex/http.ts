import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// /api/auth/signin/*, /api/auth/callback/* — the OAuth round trip runs on the
// Convex site URL, so no provider secret ever reaches the app bundle.
auth.addHttpRoutes(http);

export default http;
