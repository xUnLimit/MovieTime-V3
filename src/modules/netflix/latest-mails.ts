import type { NetflixMail } from './parse-mail';

export const NETFLIX_CODE_MAX_AGE_MS = 15 * 60 * 1000;

export type DatedNetflixMail = { receivedAt: string; mail: NetflixMail };

// Newest usable mail per account, only for the accounts the customer owns and
// only while Netflix still honours the code.
export function latestMailByAccount(
  mails: readonly DatedNetflixMail[],
  accountEmails: ReadonlySet<string>,
  now: Date,
  maxAgeMs = NETFLIX_CODE_MAX_AGE_MS,
): Map<string, DatedNetflixMail> {
  const latest = new Map<string, DatedNetflixMail>();
  for (const item of mails) {
    const account = item.mail.accountEmail;
    const age = now.getTime() - Date.parse(item.receivedAt);
    if (!account || !accountEmails.has(account) || !Number.isFinite(age) || age < 0 || age > maxAgeMs) continue;
    const current = latest.get(account);
    if (!current || Date.parse(item.receivedAt) > Date.parse(current.receivedAt)) latest.set(account, item);
  }
  return latest;
}
