import { reportError } from '@/platform/observability/logger';
import type { BotMailboxCheck } from '@/types/bot';
import { openNetflixInbox, type NetflixInbox } from './netflix-imap';

const WINDOW_MINUTES = 15;
const DEFAULT_TIMEOUT_MS = 20_000;

export type MailboxCredentials = { user: string; password: string };
type MailboxDeps = {
  open?: (user: string, password: string) => Promise<NetflixInbox>;
  now?: () => Date;
  timeoutMs?: number;
};

class MailboxTimeoutError extends Error {}

const failure = (message: string): BotMailboxCheck => ({ ok: false, message, recentNetflixMails: null });

async function closeQuietly(inbox: NetflixInbox): Promise<void> {
  try {
    await inbox.close();
  } catch (error) {
    reportError('BotMailboxCheck', 'No se pudo cerrar el buzon', error);
  }
}

// Read-only: counts recent Netflix mails and never returns their content or any credential.
export async function checkNetflixMailbox(
  credentials: MailboxCredentials | null,
  deps: MailboxDeps = {},
): Promise<BotMailboxCheck> {
  if (!credentials) return failure('El buzón de Netflix no está configurado en el servidor.');
  const open = deps.open ?? openNetflixInbox;
  const since = new Date((deps.now ?? (() => new Date()))().getTime() - WINDOW_MINUTES * 60 * 1000);
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async (): Promise<BotMailboxCheck> => {
    const inbox = await open(credentials.user, credentials.password);
    // Late opening after the timeout: nobody is waiting, so just release the connection.
    if (timedOut) {
      await closeQuietly(inbox);
      return failure('');
    }
    try {
      const mails = await inbox.recent(since);
      const count = mails.length;
      return {
        ok: true,
        message: `Conexión correcta. Hay ${count} ${count === 1 ? 'correo' : 'correos'} de Netflix en los últimos ${WINDOW_MINUTES} minutos.`,
        recentNetflixMails: count,
      };
    } finally {
      await closeQuietly(inbox);
    }
  };

  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { timedOut = true; reject(new MailboxTimeoutError()); }, deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof MailboxTimeoutError) return failure('El buzón tardó demasiado en responder. Inténtalo de nuevo.');
    reportError('BotMailboxCheck', 'La comprobacion del buzon fallo', error);
    return failure('No se pudo conectar con el buzón. Revisa las credenciales configuradas en el servidor.');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** In-memory limiter: one allowed call per key every `intervalMs`. Returns 0 when allowed, else ms to wait. */
export function createRateLimiter(intervalMs: number, now: () => number = Date.now) {
  const last = new Map<string, number>();
  return (key: string): number => {
    const current = now();
    for (const [stored, at] of last) if (current - at >= intervalMs) last.delete(stored);
    const previous = last.get(key);
    if (previous !== undefined && current - previous < intervalMs) return intervalMs - (current - previous);
    last.set(key, current);
    return 0;
  };
}
