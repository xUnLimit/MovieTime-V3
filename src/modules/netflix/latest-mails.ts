import type { NetflixMail } from './parse-mail';

export type DatedNetflixMail = { receivedAt: string; messageId: string | null; mail: NetflixMail };

// Every recent mail of one kind per owned account, newest first, so the caller can
// drop the ones already delivered to someone else. The window is a short, configurable
// age: Netflix sends the sign-in code to whoever asked without saying who that was, so
// the shorter it is the less likely it reaches somebody else.
export function recentMailsByAccount(
  mails: readonly DatedNetflixMail[],
  accountEmails: ReadonlySet<string>,
  kind: NetflixMail['kind'],
  now: Date,
  maxAgeMs: number,
): Map<string, DatedNetflixMail[]> {
  const byAccount = new Map<string, DatedNetflixMail[]>();
  for (const item of mails) {
    const account = item.mail.accountEmail;
    const age = now.getTime() - Date.parse(item.receivedAt);
    if (item.mail.kind !== kind || !account || !accountEmails.has(account)
      || !Number.isFinite(age) || age < 0 || age > maxAgeMs) continue;
    byAccount.set(account, [...(byAccount.get(account) ?? []), item]);
  }
  for (const list of byAccount.values()) list.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return byAccount;
}
