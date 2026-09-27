import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { z } from '@/platform/validation/zod';

const sender = 'notificaciones@yappy.com.pa';
const mailSchema = z.object({
  from: z.string().email(), receivedAt: z.iso.datetime(), subject: z.string(),
  messageId: z.string().nullable(), text: z.string(), dmarcPass: z.boolean().nullable(),
});
export type YappyInboxMail = z.infer<typeof mailSchema>;
export type YappyInbox = {
  uidValidity: number;
  search(afterUid: number, since: Date | null): Promise<number[]>;
  read(uid: number): Promise<YappyInboxMail | null>;
  close(): Promise<void>;
};

// A Yappy notice that cannot be downloaded or decoded is recorded and skipped;
// retrying it would block every later notice behind it.
export class UnreadableYappyMailError extends Error {
  constructor(readonly receivedAt: string) {
    super('Unreadable Yappy mail');
    this.name = 'UnreadableYappyMailError';
  }
}

const timeoutMs = 15_000;
const maxMessageBytes = 2 * 1024 * 1024;
function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([operation, new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('IMAP request timeout')), timeoutMs);
  })]).finally(() => { if (timer) clearTimeout(timer); });
}

export function gmailDmarcPass(headerLines: ReadonlyArray<{ key: string; line: string }>): boolean | null {
  const top = headerLines.find((header) => header.key.toLowerCase() === 'authentication-results' &&
    /^authentication-results:\s*mx\.google\.com(?:\s|;)/i.test(header.line));
  if (!top) return null;
  return /(?:^|[;\s])dmarc=pass(?:[;\s(]|$)/i.test(top.line);
}

export async function parseYappyMime(source: Buffer, receivedAt = new Date()): Promise<YappyInboxMail | null> {
  const mail = await simpleParser(source, { skipImageLinks: true, maxHtmlLengthToParse: 65_536 });
  const addresses = mail.from?.value ?? [];
  if (addresses.length !== 1 || addresses[0].address?.toLowerCase() !== sender) return null;
  const parsed = mailSchema.safeParse({
    from: addresses[0].address, receivedAt: receivedAt.toISOString(),
    subject: mail.subject ?? '', messageId: mail.messageId ?? null,
    text: mail.text ?? '', dmarcPass: gmailDmarcPass(mail.headerLines),
  });
  return parsed.success ? parsed.data : null;
}

export async function openYappyInbox(user: string, password: string): Promise<YappyInbox> {
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
      uidValidity: Number(mailbox.uidValidity),
      async search(afterUid, since) {
        const query = since ? { from: sender, since } : { from: sender, uid: `${afterUid + 1}:*` };
        const result = await withTimeout(client.search(query, { uid: true }));
        if (!Array.isArray(result)) throw new Error('IMAP search failed');
        return result.filter((uid) => Number.isSafeInteger(uid) && uid > afterUid).sort((a, b) => a - b);
      },
      async read(uid) {
        const envelope = await withTimeout(client.fetchOne(uid, { envelope: true, internalDate: true, size: true }, { uid: true }));
        const from = envelope && envelope.envelope?.from;
        if (!from || from.length !== 1 || from[0].address?.toLowerCase() !== sender) return null;
        const internalDate = envelope.internalDate ? new Date(envelope.internalDate) : new Date();
        if (typeof envelope.size === 'number' && envelope.size > maxMessageBytes) {
          throw new UnreadableYappyMailError(internalDate.toISOString());
        }
        const message = await withTimeout(client.fetchOne(uid, { source: true }, { uid: true }));
        if (!message || !message.source) throw new Error('IMAP message unavailable');
        try {
          return await parseYappyMime(message.source, internalDate);
        } catch {
          throw new UnreadableYappyMailError(internalDate.toISOString());
        }
      },
      async close() { await withTimeout(client.logout()); },
    };
  } catch (error) {
    client.close();
    throw error;
  }
}
