import { describe, expect, it } from 'vitest';
import { recentMailsByAccount, type DatedNetflixMail } from './latest-mails';

const now = new Date('2026-10-02T04:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const login = (account: string | null, receivedAt: string, code = '1111'): DatedNetflixMail => ({
  receivedAt, messageId: `<${code}@x.test>`, mail: { kind: 'login_code', accountEmail: account, code },
});
const travel = (account: string | null, receivedAt: string): DatedNetflixMail => ({
  receivedAt, messageId: null,
  mail: { kind: 'travel_link', accountEmail: account, verifyUrl: 'https://www.netflix.com/account/travel/verify?nftoken=A', profileName: 'Uno' },
});
const LOGIN_WINDOW = 5 * 60_000;
const TRAVEL_WINDOW = 15 * 60_000;
const owned = new Set(['a@x.test', 'b@x.test']);

describe('recentMailsByAccount', () => {
  it('keeps every recent mail of each owned account, newest first', () => {
    const result = recentMailsByAccount([
      login('a@x.test', minutesAgo(4), 'old'), login('a@x.test', minutesAgo(1), 'new'), login('b@x.test', minutesAgo(3)),
    ], owned, 'login_code', now, LOGIN_WINDOW);
    expect([...result.keys()].sort()).toEqual(['a@x.test', 'b@x.test']);
    expect(result.get('a@x.test')?.map((item) => item.mail)).toEqual([
      expect.objectContaining({ code: 'new' }), expect.objectContaining({ code: 'old' }),
    ]);
  });

  it('only returns the requested kind', () => {
    const mails = [login('a@x.test', minutesAgo(1)), travel('b@x.test', minutesAgo(1))];
    expect([...recentMailsByAccount(mails, owned, 'login_code', now, LOGIN_WINDOW).keys()]).toEqual(['a@x.test']);
    expect([...recentMailsByAccount(mails, owned, 'travel_link', now, TRAVEL_WINDOW).keys()]).toEqual(['b@x.test']);
  });

  it('drops accounts the customer does not own and unknown accounts', () => {
    const result = recentMailsByAccount([login('other@x.test', minutesAgo(1)), login(null, minutesAgo(1))], owned, 'login_code', now, LOGIN_WINDOW);
    expect(result.size).toBe(0);
  });

  it('applies the window it is given', () => {
    expect(recentMailsByAccount([login('a@x.test', minutesAgo(3))], owned, 'login_code', now, 2 * 60_000).size).toBe(0);
    expect(recentMailsByAccount([login('a@x.test', minutesAgo(3))], owned, 'login_code', now, 3 * 60_000).size).toBe(1);
  });

  it('applies the window of each kind', () => {
    expect(recentMailsByAccount([login('a@x.test', minutesAgo(5))], owned, 'login_code', now, LOGIN_WINDOW).size).toBe(1);
    expect(recentMailsByAccount([login('a@x.test', minutesAgo(6))], owned, 'login_code', now, LOGIN_WINDOW).size).toBe(0);
    expect(recentMailsByAccount([travel('a@x.test', minutesAgo(15))], owned, 'travel_link', now, TRAVEL_WINDOW).size).toBe(1);
    expect(recentMailsByAccount([travel('a@x.test', minutesAgo(16))], owned, 'travel_link', now, TRAVEL_WINDOW).size).toBe(0);
  });

  it('rejects future or invalid dates', () => {
    expect(recentMailsByAccount([login('a@x.test', minutesAgo(-1))], owned, 'login_code', now, LOGIN_WINDOW).size).toBe(0);
    expect(recentMailsByAccount([login('a@x.test', 'nope')], owned, 'login_code', now, LOGIN_WINDOW).size).toBe(0);
  });
});
