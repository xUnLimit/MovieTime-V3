import { parseNetflixMail, parseTravelCode, profileMatches, recentMailsByAccount } from '@/modules/netflix';
import type { CodeDelivery, CodeProvider } from './types';

export const netflixProvider: CodeProvider = Object.freeze<CodeProvider>({
  key: 'netflix',
  label: 'Netflix',
  mailboxConfigKey: 'NETFLIX_IMAP',
  kinds: Object.freeze(['login_code', 'travel_link'] as const),
  parse: (raw: { html: string }) => parseNetflixMail(raw.html),
  belongsTo: (mail, service, profile) => mail.accountEmail === service.email
    && (mail.kind !== 'travel_link' || profileMatches(mail.profileName, profile.profiles)),
  recentMails: recentMailsByAccount,
  parseTravelPage: parseTravelCode,
  formatDelivery(mail, { minutes, travelCode }): CodeDelivery {
    if (mail.kind === 'login_code') return {
      message: 'login_code_sent', values: { codigo: mail.code, minutos: minutes }, result: 'code',
    };
    if (travelCode) return {
      message: 'travel_code_sent',
      values: { codigo: travelCode, perfil: mail.profileName ?? '', minutos: minutes }, result: 'code',
    };
    return { message: 'travel_link_sent', values: { enlace: mail.verifyUrl, minutos: minutes }, result: 'link' };
  },
});
