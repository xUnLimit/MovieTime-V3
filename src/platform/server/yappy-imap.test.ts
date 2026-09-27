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
import { gmailDmarcPass, openYappyInbox, parseYappyMime, UnreadableYappyMailError } from './yappy-imap';

const plain = 'Te enviaron por Yappy\n$2.00\nEnviado por\nEmmanuel S.\n****-0268\nFecha 27 sept 2026 01:07 p. m.\nMensaje\nConfirmación GZCSS-20613095';
const headers = 'From: Notificaciones <notificaciones@yappy.com.pa>\r\nSubject: Te enviaron por Yappy\r\n' +
  'Authentication-Results: mx.google.com; dmarc=pass header.from=yappy.com.pa\r\n' +
  'Authentication-Results: fake.example; dmarc=fail\r\n';

beforeEach(() => {
  vi.clearAllMocks();
  mime.fail = false;
  driver.options = null;
  driver.connect.mockResolvedValue(undefined);
  driver.mailboxOpen.mockResolvedValue({ uidValidity: BigInt(31), readOnly: true });
  driver.search.mockResolvedValue([6, 5, 5]);
  driver.fetchOne.mockImplementation(async (_uid: number, query: { envelope?: boolean }) => query.envelope ?
    { envelope: { from: [{ address: 'notificaciones@yappy.com.pa' }] }, internalDate: new Date('2026-09-27T18:07:00Z') } :
    { source: Buffer.from(headers + '\r\n' + plain) });
  driver.logout.mockResolvedValue(undefined);
});

describe('read-only Gmail IMAP adapter', () => {
  it('uses verified TLS and opens INBOX in EXAMINE mode', async () => {
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    expect(driver.options).toMatchObject({ host: 'imap.gmail.com', port: 993, secure: true,
      tls: { rejectUnauthorized: true, servername: 'imap.gmail.com' }, logger: false });
    expect(driver.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
    await inbox.close();
    expect(driver.logout).toHaveBeenCalledOnce();
  });
  it('searches only the sender with UID cursor or seven-day SINCE', async () => {
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    expect(await inbox.search(5, null)).toEqual([6]);
    expect(driver.search).toHaveBeenCalledWith({ from: 'notificaciones@yappy.com.pa', uid: '6:*' }, { uid: true });
    const since = new Date('2026-09-20T00:00:00Z');
    await inbox.search(0, since);
    expect(driver.search).toHaveBeenCalledWith({ from: 'notificaciones@yappy.com.pa', since }, { uid: true });
    await inbox.close();
  });
  it('fetches by UID without mutating flags and revalidates From', async () => {
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    expect((await inbox.read(6))?.text).toContain('Confirmación GZCSS-20613095');
    expect(driver.fetchOne).toHaveBeenCalledWith(6, { envelope: true, internalDate: true, size: true }, { uid: true });
    expect(driver.fetchOne).toHaveBeenCalledWith(6, { source: true }, { uid: true });
    driver.fetchOne.mockResolvedValueOnce({ envelope: { from: [{ address: 'other@example.com' }] } });
    expect(await inbox.read(7)).toBeNull();
    expect(driver.fetchOne).not.toHaveBeenCalledWith(7, { source: true }, { uid: true });
    await inbox.close();
  });
  it('marks oversized Yappy notices unreadable without downloading their source', async () => {
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    driver.fetchOne.mockResolvedValueOnce({ envelope: { from: [{ address: 'notificaciones@yappy.com.pa' }] },
      internalDate: new Date('2026-09-27T18:07:00Z'), size: 3 * 1024 * 1024 });
    const error = await inbox.read(11).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UnreadableYappyMailError);
    expect(error).toMatchObject({ receivedAt: '2026-09-27T18:07:00.000Z' });
    expect(driver.fetchOne).not.toHaveBeenCalledWith(11, { source: true }, { uid: true });
    await inbox.close();
  });
  it('marks Yappy notices with undecodable MIME unreadable', async () => {
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    mime.fail = true;
    await expect(inbox.read(12)).rejects.toBeInstanceOf(UnreadableYappyMailError);
    await inbox.close();
  });
  it('rejects a server that did not grant read-only access', async () => {
    driver.mailboxOpen.mockResolvedValueOnce({ uidValidity: BigInt(31), readOnly: false });
    await expect(openYappyInbox('owner@gmail.com', 'app-password')).rejects.toThrow('read-only');
    expect(driver.close).toHaveBeenCalledOnce();
  });
  it('closes the socket on connection failure and rejects missing source', async () => {
    driver.connect.mockRejectedValueOnce(new Error('connect failed'));
    await expect(openYappyInbox('owner@gmail.com', 'app-password')).rejects.toThrow('connect failed');
    expect(driver.close).toHaveBeenCalledOnce();
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    driver.fetchOne.mockResolvedValueOnce({ envelope: { from: [{ address: 'notificaciones@yappy.com.pa' }] } });
    driver.fetchOne.mockResolvedValueOnce(false);
    await expect(inbox.read(9)).rejects.toThrow('unavailable');
    await inbox.close();
  });
  it('rejects failed server searches and never fetches source for a foreign envelope', async () => {
    const inbox = await openYappyInbox('owner@gmail.com', 'app-password');
    driver.search.mockResolvedValueOnce(false);
    await expect(inbox.search(3, null)).rejects.toThrow('search failed');
    driver.fetchOne.mockResolvedValueOnce({ envelope: { from: [{ address: 'other@example.com' }] } });
    expect(await inbox.read(10)).toBeNull();
    expect(driver.fetchOne).not.toHaveBeenCalledWith(10, { source: true }, { uid: true });
    await inbox.close();
  });
});

describe('MIME and authentication results', () => {
  it('converts HTML-only mail into parser input without executing HTML', async () => {
    const html = '<html><body><p>Te enviaron por Yappy</p><p>$2.00</p><p>Enviado por<br>Emmanuel S.<br>****-0268</p>' +
      '<p>Fecha 27 sept 2026 01:07 p. m.</p><p>Mensaje<br>Confirmación GZCSS-20613095</p><script>alert(1)</script></body></html>';
    const raw = Buffer.from(headers + 'Content-Type: text/html; charset=utf-8\r\n\r\n' + html);
    const result = await parseYappyMime(raw);
    expect(result?.text).toContain('Confirmación GZCSS-20613095');
    expect(result?.text).not.toContain('<script>');
  });
  it('trusts only the first mx.google.com Authentication-Results header', () => {
    expect(gmailDmarcPass([
      { key: 'authentication-results', line: 'Authentication-Results: mx.google.com; dmarc=fail' },
      { key: 'authentication-results', line: 'Authentication-Results: mx.google.com; dmarc=pass' },
    ])).toBe(false);
    expect(gmailDmarcPass([
      { key: 'authentication-results', line: 'Authentication-Results: attacker.example; dmarc=pass' },
      { key: 'authentication-results', line: 'Authentication-Results: mx.google.com; dmarc=pass' },
    ])).toBe(true);
    expect(gmailDmarcPass([{ key: 'authentication-results', line: 'Authentication-Results: attacker.example; dmarc=pass' }])).toBeNull();
    expect(gmailDmarcPass([])).toBeNull();
  });
  it('rejects multiple From addresses and mismatches between envelope and MIME', async () => {
    const source = Buffer.from(headers.replace('notificaciones@yappy.com.pa', 'other@example.com') + '\r\n' + plain);
    expect(await parseYappyMime(source)).toBeNull();
    const multiple = Buffer.from(headers.replace('notificaciones@yappy.com.pa', 'notificaciones@yappy.com.pa, other@example.com') + '\r\n' + plain);
    expect(await parseYappyMime(multiple)).toBeNull();
  });
});
