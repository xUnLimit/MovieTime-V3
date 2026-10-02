import { describe, expect, it } from 'vitest';
import { latestMailByAccount, type DatedNetflixMail } from './latest-mails';

const now = new Date('2026-10-02T04:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const login = (account: string | null, receivedAt: string, code = '1111'): DatedNetflixMail => ({
  receivedAt, mail: { kind: 'login_code', accountEmail: account, code },
});
const owned = new Set(['a@x.test', 'b@x.test']);

describe('latestMailByAccount', () => {
  it('keeps the newest mail of each owned account', () => {
    const result = latestMailByAccount([
      login('a@x.test', minutesAgo(10), 'old'), login('a@x.test', minutesAgo(2), 'new'), login('b@x.test', minutesAgo(5)),
    ], owned, now);
    expect([...result.keys()].sort()).toEqual(['a@x.test', 'b@x.test']);
    expect(result.get('a@x.test')?.mail).toMatchObject({ code: 'new' });
  });

  it('ignores a newer mail that arrives before an older one in the list', () => {
    const result = latestMailByAccount([login('a@x.test', minutesAgo(1), 'new'), login('a@x.test', minutesAgo(9), 'old')], owned, now);
    expect(result.get('a@x.test')?.mail).toMatchObject({ code: 'new' });
  });

  it('drops accounts the customer does not own, unknown accounts and expired codes', () => {
    const result = latestMailByAccount([
      login('other@x.test', minutesAgo(1)), login(null, minutesAgo(1)), login('a@x.test', minutesAgo(16)),
    ], owned, now);
    expect(result.size).toBe(0);
  });

  it('accepts a mail exactly at the limit and rejects future or invalid dates', () => {
    expect(latestMailByAccount([login('a@x.test', minutesAgo(15))], owned, now).size).toBe(1);
    expect(latestMailByAccount([login('a@x.test', minutesAgo(-1))], owned, now).size).toBe(0);
    expect(latestMailByAccount([login('a@x.test', 'nope')], owned, now).size).toBe(0);
  });
});
