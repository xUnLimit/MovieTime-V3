import { env } from './env';

// Netflix mail is forwarded from Proton to its own Gmail inbox, separate from Yappy's.
export function getNetflixMailConfig() {
  if (typeof window !== 'undefined') throw new Error('Netflix mailbox configuration is server-only');
  const { netflixImapUser, netflixImapPassword } = env;
  if (!netflixImapUser || !netflixImapPassword) return null;
  return { user: netflixImapUser, password: netflixImapPassword };
}
