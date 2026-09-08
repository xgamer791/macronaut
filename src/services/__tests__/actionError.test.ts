import { ConvexError } from 'convex/values';
import { friendlyActionError } from '../actionError';

describe('friendlyActionError', () => {
  const fallback = 'Please try that again.';

  it('preserves deliberate application errors', () => {
    expect(friendlyActionError(new ConvexError('Too many searches today'), fallback)).toBe(
      'Too many searches today',
    );
    expect(friendlyActionError({ data: 'Could not find that location' }, fallback)).toBe(
      'Could not find that location',
    );
  });

  it('never shows Convex request IDs or server diagnostics', () => {
    const raw = new Error(
      '[CONVEX A(places:geocode)] [Request ID: 724e6ac7d82afc7d] Server Error Called by client',
    );
    expect(friendlyActionError(raw, fallback)).toBe(fallback);
  });

  it('gives a useful connection message for network failures', () => {
    expect(friendlyActionError(new TypeError('Failed to fetch'), fallback)).toMatch(
      /check your connection/i,
    );
  });
});
