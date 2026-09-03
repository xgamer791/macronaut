import { convexClientOptions } from '../client';

describe('convexClientOptions', () => {
  it('reuses the cached one-hour JWT instead of rotating on every launch', () => {
    expect(convexClientOptions.initialAuthTokenReuse).toBe(true);
    expect(convexClientOptions.unsavedChangesWarning).toBe(false);
  });
});
