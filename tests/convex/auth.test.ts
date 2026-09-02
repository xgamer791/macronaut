import { describe, expect, it } from 'vitest';
import { randomDigits } from '../../convex/ResendOTP';
import { isAllowedRedirect } from '../../convex/auth';

describe('OAuth redirect allow-list', () => {
  const site = 'https://xgamer791.github.io/macronaut';

  it('allows the deployed site, the native scheme and dev URLs', () => {
    expect(isAllowedRedirect(`${site}/`, site)).toBe(true);
    expect(isAllowedRedirect('macronaut://', site)).toBe(true);
    expect(isAllowedRedirect('exp://192.168.1.20:8081/--/', site)).toBe(true);
    expect(isAllowedRedirect('http://localhost:8081/', site)).toBe(true);
  });

  it('refuses anything else, including look-alike hosts', () => {
    expect(isAllowedRedirect('https://evil.example/', site)).toBe(false);
    expect(isAllowedRedirect('https://xgamer791.github.io.evil.example/macronaut/', site)).toBe(false);
    expect(isAllowedRedirect('http://localhost.evil.example/', site)).toBe(false);
    expect(isAllowedRedirect('https://xgamer791.github.io/macronaut/', undefined)).toBe(false);
  });
});

describe('email code generation', () => {
  it('produces the requested number of digits only', () => {
    for (let i = 0; i < 50; i += 1) expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });
});
