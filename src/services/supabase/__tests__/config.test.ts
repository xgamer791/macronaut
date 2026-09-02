import { configSourceLabel, pickSupabaseConfig } from '../config';

const ENV = { url: 'https://from-env.supabase.co', key: 'sb_publishable_env' };
const FILE = { url: 'https://from-file.supabase.co', key: 'sb_publishable_file' };

describe('pickSupabaseConfig', () => {
  it('reports no configuration when both sources are empty', () => {
    expect(pickSupabaseConfig('', '', '', '')).toEqual({ url: '', anonKey: '', source: 'none' });
    expect(pickSupabaseConfig(undefined, undefined, undefined, undefined)).toEqual({
      url: '',
      anonKey: '',
      source: 'none',
    });
  });

  it('uses the committed file when no environment variables are set', () => {
    expect(pickSupabaseConfig(undefined, undefined, FILE.url, FILE.key)).toEqual({
      url: FILE.url,
      anonKey: FILE.key,
      source: 'file',
    });
  });

  it('lets the environment override the committed file', () => {
    expect(pickSupabaseConfig(ENV.url, ENV.key, FILE.url, FILE.key)).toEqual({
      url: ENV.url,
      anonKey: ENV.key,
      source: 'env',
    });
  });

  it('trims whitespace, so a pasted value with a stray newline still works', () => {
    expect(pickSupabaseConfig(undefined, undefined, `  ${FILE.url}\n`, ` ${FILE.key} `)).toEqual({
      url: FILE.url,
      anonKey: FILE.key,
      source: 'file',
    });
  });

  it('treats whitespace-only values as unset', () => {
    expect(pickSupabaseConfig('   ', '\n', FILE.url, FILE.key).source).toBe('file');
  });

  // Completing a half-filled source from the other one would aim the app at one
  // project while authenticating with another project's key.
  it('never mixes a URL from one source with a key from the other', () => {
    expect(pickSupabaseConfig(ENV.url, undefined, FILE.url, FILE.key)).toEqual({
      url: ENV.url,
      anonKey: '',
      source: 'env',
    });
    expect(pickSupabaseConfig(undefined, ENV.key, FILE.url, FILE.key)).toEqual({
      url: '',
      anonKey: ENV.key,
      source: 'env',
    });
    expect(pickSupabaseConfig(undefined, undefined, FILE.url, '')).toEqual({
      url: FILE.url,
      anonKey: '',
      source: 'file',
    });
  });
});

describe('configSourceLabel', () => {
  it('names the place a value should be corrected', () => {
    expect(configSourceLabel('env')).toBe('EXPO_PUBLIC_SUPABASE_*');
    expect(configSourceLabel('file')).toBe('supabase.json');
    expect(configSourceLabel('none')).toBe('supabase.json');
  });
});
