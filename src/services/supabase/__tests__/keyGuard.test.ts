import { inspectPublishableKey, isValidSupabaseUrl } from '../keyGuard';

function jwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('inspectPublishableKey', () => {
  it('accepts a legacy anon JWT', () => {
    expect(inspectPublishableKey(jwt({ role: 'anon', iss: 'supabase' }))).toBeNull();
  });

  it('accepts a new-style publishable key', () => {
    expect(inspectPublishableKey('sb_publishable_abc123')).toBeNull();
  });

  it('rejects a service_role JWT, which bypasses RLS', () => {
    expect(inspectPublishableKey(jwt({ role: 'service_role' }))).toBe('service-role');
  });

  it('rejects a new-style secret key', () => {
    expect(inspectPublishableKey('sb_secret_abc123')).toBe('secret-key');
  });

  it('reports an empty key', () => {
    expect(inspectPublishableKey('')).toBe('empty');
    expect(inspectPublishableKey('   ')).toBe('empty');
    expect(inspectPublishableKey(undefined)).toBe('empty');
  });

  it('rejects anything it cannot recognise', () => {
    expect(inspectPublishableKey('not-a-key')).toBe('malformed');
    expect(inspectPublishableKey(jwt({ role: 'postgres' }))).toBe('malformed');
  });
});

describe('isValidSupabaseUrl', () => {
  it('accepts https project URLs', () => {
    expect(isValidSupabaseUrl('https://abcdefgh.supabase.co')).toBe(true);
    expect(isValidSupabaseUrl('https://api.example.com')).toBe(true);
  });

  it('rejects cleartext http against a remote host', () => {
    expect(isValidSupabaseUrl('http://abcdefgh.supabase.co')).toBe(false);
  });

  it('allows http on localhost for local development', () => {
    expect(isValidSupabaseUrl('http://localhost:54321')).toBe(true);
    expect(isValidSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
  });

  it('rejects empty and malformed values', () => {
    expect(isValidSupabaseUrl('')).toBe(false);
    expect(isValidSupabaseUrl(undefined)).toBe(false);
    expect(isValidSupabaseUrl('abcdefgh.supabase.co')).toBe(false);
  });
});
