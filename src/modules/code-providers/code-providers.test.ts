import { describe, expect, it } from 'vitest';
import { assertCodeAccess, assertCodeProviderKey, getCodeProvider, listCodeProviders } from './index';
import { netflixProvider } from './netflix-provider';
import { parseNetflixMail, parseTravelCode, profileMatches, recentMailsByAccount } from '@/modules/netflix';
import type { CodeMail } from './types';

const login: CodeMail = { kind: 'login_code', accountEmail: 'a@example.test', code: '1234' };
const travel: CodeMail = { kind: 'travel_link', accountEmail: 'a@example.test', profileName: 'Ana',
  verifyUrl: 'https://www.netflix.com/account/travel/verify?nftoken=TEST' };
describe('code provider registry and Netflix parity', () => {
  it('registers only the real Netflix adapter, with immutable metadata', () => {
    expect(listCodeProviders()).toEqual([netflixProvider]);
    expect(getCodeProvider('netflix')).toBe(netflixProvider);
    for (const key of ['spotify', 'NETFLIX', '__proto__', '', null, undefined]) expect(getCodeProvider(key)).toBeNull();
    expect(Object.isFrozen(listCodeProviders())).toBe(true);
    expect(netflixProvider).toMatchObject({ key: 'netflix', label: 'Netflix', mailboxConfigKey: 'NETFLIX_IMAP',
      kinds: ['login_code', 'travel_link'] });
  });
  it('validates provider and service DB contracts without coercion', () => {
    for (const key of [null, undefined, 'netflix']) expect(() => assertCodeProviderKey(key)).not.toThrow();
    for (const key of ['fake', 1, {}, true]) expect(() => assertCodeProviderKey(key)).toThrow();
    for (const enabled of [undefined, false]) expect(() => assertCodeAccess(enabled, null)).not.toThrow();
    expect(() => assertCodeAccess(true, 'netflix')).not.toThrow();
    for (const [enabled, key] of [[true, null], [true, 'fake'], ['true', 'netflix']]) {
      expect(() => assertCodeAccess(enabled, key)).toThrow();
    }
  });
  it.each(['', '<p>Unrelated mail</p>', '<td class="lrg-number">1234</td>',
    '<a href="https://www.netflix.com/account/travel/verify?nftoken=TEST">Obtener codigo</a>'])
  ('uses the existing mail parser unchanged', (html) => {
    expect(netflixProvider.parse({ html })).toEqual(parseNetflixMail(html));
  });
  it('preserves account and profile isolation', () => {
    expect(netflixProvider.belongsTo(login, { email: 'a@example.test' }, { profiles: [] })).toBe(true);
    expect(netflixProvider.belongsTo(login, { email: 'b@example.test' }, { profiles: ['Ana'] })).toBe(false);
    for (const profiles of [[], ['Other'], [' ANA ']]) {
      expect(netflixProvider.belongsTo(travel, { email: 'a@example.test' }, { profiles }))
        .toBe(profileMatches(travel.kind === 'travel_link' ? travel.profileName : null, profiles));
    }
    expect(netflixProvider.belongsTo({ ...travel, accountEmail: null }, { email: 'a@example.test' }, { profiles: ['Ana'] })).toBe(false);
  });
  it('preserves recency and travel parsing', () => {
    const now = new Date('2026-10-02T00:00:00Z');
    const mails = [{ receivedAt: now.toISOString(), messageId: null, mail: login }];
    expect(netflixProvider.recentMails(mails, new Set(['a@example.test']), 'login_code', now, 60000))
      .toEqual(recentMailsByAccount(mails, new Set(['a@example.test']), 'login_code', now, 60000));
    for (const html of ['', '<p>1234</p>']) expect(netflixProvider.parseTravelPage(html)).toEqual(parseTravelCode(html));
  });
  it('formats exactly the existing template keys and parameters', () => {
    expect(netflixProvider.formatDelivery(login, { minutes: '5' })).toEqual({
      message: 'login_code_sent', values: { codigo: '1234', minutos: '5' }, result: 'code',
    });
    expect(netflixProvider.formatDelivery(travel, { minutes: '15', travelCode: '5678' })).toEqual({
      message: 'travel_code_sent', values: { codigo: '5678', perfil: 'Ana', minutos: '15' }, result: 'code',
    });
    expect(netflixProvider.formatDelivery(travel, { minutes: '15' })).toMatchObject({
      message: 'travel_link_sent', values: { minutos: '15', enlace: travel.kind === 'travel_link' ? travel.verifyUrl : '' }, result: 'link',
    });
    if (travel.kind === 'travel_link') expect(netflixProvider.formatDelivery({ ...travel, profileName: null },
      { minutes: '15', travelCode: '5678' }).values.perfil).toBe('');
  });
});
