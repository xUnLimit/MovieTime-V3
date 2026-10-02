import { describe, expect, it, vi } from 'vitest';

const reportError = vi.hoisted(() => vi.fn());
vi.mock('@/platform/observability/logger', () => ({ reportError }));
vi.mock('./netflix-imap', () => ({ openNetflixInbox: vi.fn() }));

import { checkNetflixMailbox, createRateLimiter } from './bot-mailbox-check';

const credentials = { user: 'owner@gmail.com', password: 'app-password' };
const now = () => new Date('2026-10-02T12:00:00Z');

function inbox(overrides: { recent?: () => Promise<unknown[]>; close?: () => Promise<void> } = {}) {
  return {
    recent: vi.fn(overrides.recent ?? (async () => [{}, {}])),
    close: vi.fn(overrides.close ?? (async () => undefined)),
  };
}

describe('checkNetflixMailbox', () => {
  it('counts the Netflix mails of the last 15 minutes and always closes the mailbox', async () => {
    const box = inbox();
    const open = vi.fn(async () => box as never);
    const result = await checkNetflixMailbox(credentials, { open, now });
    expect(result).toEqual({
      ok: true, message: 'Conexión correcta. Hay 2 correos de Netflix en los últimos 15 minutos.', recentNetflixMails: 2,
    });
    expect(open).toHaveBeenCalledWith('owner@gmail.com', 'app-password');
    expect(box.recent).toHaveBeenCalledWith(new Date('2026-10-02T11:45:00Z'));
    expect(box.close).toHaveBeenCalledTimes(1);
  });

  it('uses the singular for one mail', async () => {
    const result = await checkNetflixMailbox(credentials, { open: async () => inbox({ recent: async () => [{}] }) as never, now });
    expect(result.message).toContain('Hay 1 correo de Netflix');
  });

  it('reports a missing configuration without opening anything', async () => {
    const open = vi.fn();
    await expect(checkNetflixMailbox(null, { open })).resolves.toEqual({
      ok: false, message: 'El buzón de Netflix no está configurado en el servidor.', recentNetflixMails: null,
    });
    expect(open).not.toHaveBeenCalled();
  });

  it('translates IMAP errors into a generic message that carries no credentials', async () => {
    const result = await checkNetflixMailbox(credentials, {
      open: async () => { throw new Error('AUTHENTICATIONFAILED for owner@gmail.com app-password'); }, now,
    });
    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/owner|app-password|AUTHENTICATION/);
    expect(result.recentNetflixMails).toBeNull();
    expect(reportError).toHaveBeenCalled();
  });

  it('closes the mailbox even when reading fails, and survives a failing close', async () => {
    const box = inbox({ recent: async () => { throw new Error('boom'); }, close: async () => { throw new Error('close'); } });
    const result = await checkNetflixMailbox(credentials, { open: async () => box as never, now });
    expect(result.ok).toBe(false);
    expect(box.close).toHaveBeenCalledTimes(1);
  });

  it('times out with a friendly message and releases a mailbox that opens late', async () => {
    const box = inbox();
    let release: (value: never) => void = () => undefined;
    const open = () => new Promise<never>((resolve) => { release = resolve; });
    const result = await checkNetflixMailbox(credentials, { open, now, timeoutMs: 5 });
    expect(result).toEqual({ ok: false, message: 'El buzón tardó demasiado en responder. Inténtalo de nuevo.', recentNetflixMails: null });
    release(box as never);
    await vi.waitFor(() => expect(box.close).toHaveBeenCalledTimes(1));
    expect(box.recent).not.toHaveBeenCalled();
  });
});

describe('createRateLimiter', () => {
  it('allows one call per interval per key and reports the wait', () => {
    let time = 1_000;
    const take = createRateLimiter(10_000, () => time);
    expect(take('a')).toBe(0);
    time += 4_000;
    expect(take('a')).toBe(6_000);
    expect(take('b')).toBe(0);
    time += 6_000;
    expect(take('a')).toBe(0);
  });
});
