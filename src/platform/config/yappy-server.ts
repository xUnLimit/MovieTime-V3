import { env } from './env';

export function getYappyServerConfig() {
  if (typeof window !== 'undefined') throw new Error('Yappy configuration is server-only');
  const { yappyImapUser, yappyImapPassword, yappySyncSecret } = env;
  if (!yappyImapUser || !yappyImapPassword || !yappySyncSecret) return null;
  return { user: yappyImapUser, password: yappyImapPassword, syncSecret: yappySyncSecret };
}
