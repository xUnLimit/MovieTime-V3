import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

type NetflixInboxMail = { receivedAt: string; html: string };
export type NetflixInbox = {
  recent(since: Date): Promise<NetflixInboxMail[]>;
  close(): Promise<void>;
};

const timeoutMs = 15_000;
const maxMessageBytes = 2 * 1024 * 1024;
const maxMessages = 25;
const senderDomain = 'netflix.com';

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([operation, new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('IMAP request timeout')), timeoutMs);
  })]).finally(() => { if (timer) clearTimeout(timer); });
}

function isNetflixSender(address: string | undefined): boolean {
  const host = address?.toLowerCase().split('@')[1] ?? '';
  return host === senderDomain || host.endsWith(`.${senderDomain}`);
}

// Read-only on purpose: the inbox is shared with the Yappy payment sync and a
// WhatsApp request must never change flags or delete mail.
export async function openNetflixInbox(user: string, password: string): Promise<NetflixInbox> {
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    tls: { rejectUnauthorized: true, servername: 'imap.gmail.com' },
    auth: { user, pass: password }, logger: false, disableAutoIdle: true,
    connectionTimeout: timeoutMs, greetingTimeout: timeoutMs, socketTimeout: timeoutMs,
    maxLiteralSize: maxMessageBytes + 64 * 1024, maxResponseSize: maxMessageBytes + 128 * 1024,
  });
  try {
    await withTimeout(client.connect());
    const mailbox = await withTimeout(client.mailboxOpen('INBOX', { readOnly: true }));
    if (!mailbox.readOnly) throw new Error('IMAP mailbox is not read-only');
    return {
      async recent(since) {
        const result = await withTimeout(client.search({ from: senderDomain, since }, { uid: true }));
        if (!Array.isArray(result)) throw new Error('IMAP search failed');
        const mails: NetflixInboxMail[] = [];
        for (const uid of result.sort((a, b) => b - a).slice(0, maxMessages)) {
          const envelope = await withTimeout(client.fetchOne(uid, { envelope: true, internalDate: true, size: true }, { uid: true }));
          const from = envelope && envelope.envelope?.from;
          const received = envelope && envelope.internalDate ? new Date(envelope.internalDate) : null;
          if (!from || from.length !== 1 || !isNetflixSender(from[0].address) || !received || received < since
            || (typeof envelope.size === 'number' && envelope.size > maxMessageBytes)) continue;
          const message = await withTimeout(client.fetchOne(uid, { source: true }, { uid: true }));
          if (!message || !message.source) continue;
          try {
            const parsed = await simpleParser(message.source, { skipImageLinks: true });
            if (typeof parsed.html === 'string') mails.push({ receivedAt: received.toISOString(), html: parsed.html });
          } catch {
            // A message that cannot be decoded is skipped; it must not block the newer ones.
          }
        }
        return mails;
      },
      async close() { await withTimeout(client.logout()); },
    };
  } catch (error) {
    client.close();
    throw error;
  }
}
