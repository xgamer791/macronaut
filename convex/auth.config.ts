/** Tells Convex to accept the JWTs Convex Auth issues (their issuer is this
 * deployment's own site URL). */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
