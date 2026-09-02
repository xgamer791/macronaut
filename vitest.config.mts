import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Backend function tests run the real Convex functions against convex-test's
 * in-memory backend, driven through the app's own client repositories.
 * Everything under src/ stays on Jest (jest.config.js). */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['tests/convex/**/*.test.ts'],
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
  },
});
