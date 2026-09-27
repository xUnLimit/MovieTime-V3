import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ yappyImapUser: 'owner@gmail.com', yappyImapPassword: 'app-password',
  yappySyncSecret: 'long-sync-secret' }));
vi.mock('./env', () => ({ env }));
import { getYappyServerConfig } from './yappy-server';

beforeEach(() => {
  vi.stubGlobal('window', undefined);
  env.yappyImapUser = 'owner@gmail.com';
  env.yappyImapPassword = 'app-password';
  env.yappySyncSecret = 'long-sync-secret';
});
afterEach(() => vi.unstubAllGlobals());

describe('server-only Yappy configuration', () => {
  it('requires Gmail credentials and the cron secret', () => {
    expect(getYappyServerConfig()).toEqual({ user: 'owner@gmail.com', password: 'app-password', syncSecret: 'long-sync-secret' });
    env.yappyImapPassword = '';
    expect(getYappyServerConfig()).toBeNull();
    env.yappyImapPassword = 'app-password';
    env.yappySyncSecret = '';
    expect(getYappyServerConfig()).toBeNull();
  });
  it('refuses browser access', () => {
    vi.stubGlobal('window', {});
    expect(() => getYappyServerConfig()).toThrow('server-only');
  });
});
