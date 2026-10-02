import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ netflixImapUser: 'owner@gmail.com', netflixImapPassword: 'app-password' }));
vi.mock('./env', () => ({ env }));
import { getNetflixMailConfig } from './netflix-server';

beforeEach(() => {
  vi.stubGlobal('window', undefined);
  env.netflixImapUser = 'owner@gmail.com';
  env.netflixImapPassword = 'app-password';
});
afterEach(() => vi.unstubAllGlobals());

describe('server-only Netflix mailbox configuration', () => {
  it('uses the dedicated Gmail credentials', () => {
    expect(getNetflixMailConfig()).toEqual({ user: 'owner@gmail.com', password: 'app-password' });
  });

  it('is unavailable without either credential', () => {
    env.netflixImapPassword = '';
    expect(getNetflixMailConfig()).toBeNull();
    env.netflixImapPassword = 'app-password';
    env.netflixImapUser = '';
    expect(getNetflixMailConfig()).toBeNull();
  });

  it('refuses browser access', () => {
    vi.stubGlobal('window', {});
    expect(() => getNetflixMailConfig()).toThrow('server-only');
  });
});
