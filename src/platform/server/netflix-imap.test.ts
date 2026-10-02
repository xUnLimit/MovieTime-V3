import { beforeEach, describe, expect, it, vi } from 'vitest';

const driver = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  connect: vi.fn(), mailboxOpen: vi.fn(), search: vi.fn(), fetchOne: vi.fn(), logout: vi.fn(), close: vi.fn(),
}));
vi.mock('imapflow', () => ({ ImapFlow: class {
  constructor(options: Record<string, unknown>) { driver.options = options; }
  connect = driver.connect;
  mailboxOpen = driver.mailboxOpen;
  search = driver.search;
  fetchOne = driver.fetchOne;
  logout = driver.logout;
  close = driver.close;
} }));
const mime = vi.hoisted(() => ({ fail: false }));
vi.mock('mailparser', async (importOriginal) => {
  const original = await importOriginal<typeof import('mailparser')>();
  return { ...original, simpleParser: (...args: Parameters<typeof original.simpleParser>) => {
    if (mime.fail) return Promise.reject(new Error('malformed MIME'));
    return original.simpleParser(...args);
  } };
});
import { openNetflixInbox } from './netflix-imap';

const since = new Date('2026-10-02T03:45:00Z');
const body = '<html><body><td class="lrg-number">3916</td></body></html>';
const source = `From: Netflix <info@account.netflix.com>\r\nMessage-ID: <abc123@ejemplo.test>\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}`;
type Query = { envelope?: boolean; source?: boolean };
const envelope = (address: string, date: Date | null = new Date('2026-10-02T03:55:00Z'), size = 1000) =>
  ({ envelope: { from: [{ address }] }, internalDate: date, size });

beforeEach(() => {
  vi.clearAllMocks();
  mime.fail = false;
  driver.options = null;
  driver.connect.mockResolvedValue(undefined);
  driver.mailboxOpen.mockResolvedValue({ readOnly: true });
  driver.search.mockResolvedValue([3, 9]);
  driver.fetchOne.mockImplementation(async (_uid: number, query: Query) =>
    query.envelope ? envelope('info@account.netflix.com') : { source: Buffer.from(source) });
  driver.logout.mockResolvedValue(undefined);
});

describe('read-only Netflix mailbox adapter', () => {
  it('uses verified TLS, opens INBOX read-only and logs out', async () => {
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    expect(driver.options).toMatchObject({ host: 'imap.gmail.com', port: 993, secure: true,
      tls: { rejectUnauthorized: true, servername: 'imap.gmail.com' }, logger: false });
    expect(driver.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
    await inbox.close();
    expect(driver.logout).toHaveBeenCalledOnce();
  });

  it('searches only Netflix mail since the cutoff and returns the newest first', async () => {
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    const mails = await inbox.recent(since);
    expect(driver.search).toHaveBeenCalledWith({ from: 'netflix.com', since }, { uid: true });
    expect(mails).toHaveLength(2);
    expect(mails[0]).toEqual({ receivedAt: '2026-10-02T03:55:00.000Z', messageId: '<abc123@ejemplo.test>', html: expect.stringContaining('3916') });
    expect(driver.fetchOne.mock.calls[0][0]).toBe(9);
    await inbox.close();
  });

  it.each([
    ['another sender', envelope('news@example.com')],
    ['a lookalike domain', envelope('info@netflix.com.evil.test')],
    ['mail older than the cutoff', envelope('info@account.netflix.com', new Date('2026-10-02T03:00:00Z'))],
    ['mail without a date', envelope('info@account.netflix.com', null)],
    ['an oversized message', envelope('info@account.netflix.com', undefined, 3 * 1024 * 1024)],
    ['an empty envelope', null],
  ])('skips %s without reading its body', async (_label, result) => {
    driver.search.mockResolvedValue([4]);
    driver.fetchOne.mockResolvedValue(result);
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    expect(await inbox.recent(since)).toEqual([]);
    expect(driver.fetchOne).not.toHaveBeenCalledWith(4, { source: true }, { uid: true });
    await inbox.close();
  });

  it('skips a message that cannot be downloaded or decoded and keeps the rest', async () => {
    driver.search.mockResolvedValue([1, 2]);
    driver.fetchOne.mockImplementation(async (uid: number, query: Query) =>
      query.envelope ? envelope('info@account.netflix.com') : uid === 2 ? { source: null } : { source: Buffer.from(source) });
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    expect(await inbox.recent(since)).toHaveLength(1);
    mime.fail = true;
    expect(await inbox.recent(since)).toEqual([]);
    await inbox.close();
  });

  it('reports no message id when the header is missing', async () => {
    driver.search.mockResolvedValue([1]);
    driver.fetchOne.mockImplementation(async (_uid: number, query: Query) =>
      query.envelope ? envelope('info@account.netflix.com') : { source: Buffer.from(source.replace(/Message-ID:[^\r]*\r\n/, '')) });
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    expect(await inbox.recent(since)).toEqual([expect.objectContaining({ messageId: null })]);
    await inbox.close();
  });

  it('ignores messages without an HTML part', async () => {
    driver.search.mockResolvedValue([1]);
    driver.fetchOne.mockImplementation(async (_uid: number, query: Query) =>
      query.envelope ? envelope('info@account.netflix.com') : { source: Buffer.from('From: info@account.netflix.com\r\n\r\nsolo texto') });
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    expect(await inbox.recent(since)).toEqual([]);
    await inbox.close();
  });

  it('reads at most 25 messages', async () => {
    driver.search.mockResolvedValue(Array.from({ length: 40 }, (_, index) => index + 1));
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    expect(await inbox.recent(since)).toHaveLength(25);
    await inbox.close();
  });

  it('fails when the search is not an array or the mailbox is not read-only', async () => {
    const inbox = await openNetflixInbox('owner@gmail.com', 'app-password');
    driver.search.mockResolvedValue(false);
    await expect(inbox.recent(since)).rejects.toThrow('IMAP search failed');
    driver.mailboxOpen.mockResolvedValue({ readOnly: false });
    await expect(openNetflixInbox('owner@gmail.com', 'app-password')).rejects.toThrow('not read-only');
    expect(driver.close).toHaveBeenCalledOnce();
  });
});
