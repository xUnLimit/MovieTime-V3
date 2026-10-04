import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnreadableYappyMailError, type YappyInbox, type YappyInboxMail } from '@/platform/server/yappy-imap';

const createServiceRoleClient = vi.hoisted(() => vi.fn());
const retryComprobantesServerUseCase = vi.hoisted(() => vi.fn());
vi.mock('./pedidos-server-use-cases', () => ({ retryComprobantesServerUseCase }));
vi.mock('./pedido-delivery-runtime', () => ({ drainOrderDeliveries: vi.fn().mockResolvedValue({ processed:0,failed:0 }) }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient }));
import { syncYappyUseCase } from './yappy-sync-use-case';

const config = { user: 'owner@gmail.com', password: 'test-pass' };
const body = 'Te enviaron por Yappy\n$2.00\nEnviado por\nEmmanuel S.\n****-0268\nFecha 27 sept 2026 01:07 p. m.\nMensaje\nConfirmación GZCSS-20613095';
const mail: YappyInboxMail = { from: 'notificaciones@yappy.com.pa', receivedAt: '2026-09-27T18:07:00Z',
  subject: 'Te enviaron por Yappy', messageId: '<notice@example.com>', text: body, dmarcPass: true };
let state = { mailbox: 'owner@gmail.com', uid_validity: 10 as number | null, last_uid: 3, last_error_code: null as string | null };
let claimed = true;
let uids = [4, 5];
let readMail: YappyInboxMail | null = mail;
let failIngest = false;
let failClaim = false;
let failState = false;
let outcome: 'nuevo' | 'duplicado' | 'ignorado' = 'nuevo';
const updates: Array<Record<string, unknown>> = [];
const calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
const search = vi.fn();
const read = vi.fn();
const close = vi.fn();
const open = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  retryComprobantesServerUseCase.mockResolvedValue(0);
  updates.length = 0;
  calls.length = 0;
  state = { mailbox: 'owner@gmail.com', uid_validity: 10, last_uid: 3, last_error_code: null };
  claimed = true; uids = [4, 5]; readMail = mail; failIngest = false; failClaim = false; failState = false; outcome = 'nuevo';
  search.mockImplementation(async () => uids);
  read.mockImplementation(async () => readMail);
  close.mockResolvedValue(undefined);
  open.mockImplementation(async (): Promise<YappyInbox> => ({ uidValidity: 10, search, read, close }));
  createServiceRoleClient.mockReturnValue({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'claim_yappy_mail_sync') return { data: claimed, error: failClaim ? new Error('claim failed') : null };
      if (name === 'ingest_yappy_payment') return failIngest ? { data: null, error: new Error('write failed') } :
        { data: [{ outcome, payment_id: outcome === 'nuevo' ? '123e4567-e89b-12d3-a456-426614174002' : null,
          match_status: outcome === 'nuevo' ? 'match_unico' : null }], error: null };
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: state, error: failState ? new Error('state failed') : null }) }) }),
      update: (payload: Record<string, unknown>) => ({ eq: async () => {
        updates.push(payload);
        if ('last_uid' in payload) state.last_uid = Number(payload.last_uid);
        return { error: null };
      } }),
    }),
  });
});

describe('Yappy IMAP synchronization', () => {
  it('persists through one RPC before advancing each UID', async () => {
    expect(await syncYappyUseCase(config, open)).toMatchObject({ scanned: 2, extracted: 2 });
    expect(search).toHaveBeenCalledWith(3, null);
    expect(calls.filter((call) => call.name === 'ingest_yappy_payment')).toHaveLength(2);
    expect(updates.filter((item) => 'last_uid' in item).map((item) => item.last_uid)).toEqual([4, 5]);
    expect(close).toHaveBeenCalledOnce();
  });
  it('retries delayed order receipts after trusted mail synchronization and preserves sync success if retry fails', async () => {
    uids = [];
    expect((await syncYappyUseCase(config, open)).errorCode).toBeNull();
    expect(retryComprobantesServerUseCase).toHaveBeenCalledTimes(1);
    retryComprobantesServerUseCase.mockRejectedValue(new Error('reconciliation temporarily unavailable'));
    expect((await syncYappyUseCase(config, open)).errorCode).toBeNull();
  });
  it('records an unreadable notice and keeps processing later UIDs', async () => {
    read.mockRejectedValueOnce(new UnreadableYappyMailError('2026-09-27T18:07:00.000Z'));
    expect(await syncYappyUseCase(config, open)).toMatchObject({ scanned: 2, invalid: 1, extracted: 1, errorCode: null });
    expect(calls.find((call) => call.name === 'record_invalid_yappy_mail')?.args).toMatchObject({
      p_uid_validity: 10, p_imap_uid: 4, p_received_at: '2026-09-27T18:07:00.000Z', p_failure_reason: 'mime_invalid' });
    expect(updates.filter((item) => 'last_uid' in item).map((item) => item.last_uid)).toEqual([4, 5]);
  });
  it('stops without advancing the cursor on transport errors', async () => {
    read.mockRejectedValueOnce(new Error('socket closed'));
    expect(await syncYappyUseCase(config, open)).toMatchObject({ errorCode: 'sync_error' });
    expect(updates.some((item) => 'last_uid' in item)).toBe(false);
  });
  it('restarts with seven-day SINCE after UIDVALIDITY changes', async () => {
    state.uid_validity = 9;
    await syncYappyUseCase(config, open);
    expect(search).toHaveBeenCalledWith(0, expect.any(Date));
    expect(updates[0]).toMatchObject({ uid_validity: 10, last_uid: 0 });
  });
  it('resets the UID cursor when the configured Gmail mailbox changes', async () => {
    state.mailbox = 'previous@gmail.com';
    await syncYappyUseCase(config, open);
    expect(search).toHaveBeenCalledWith(0, expect.any(Date));
    expect(updates[0]).toMatchObject({ mailbox: 'owner@gmail.com', last_uid: 0 });
  });
  it('skips mail earlier than the exact seven-day cutoff after server SINCE', async () => {
    state.uid_validity = null;
    readMail = { ...mail, receivedAt: '2020-01-01T00:00:00Z' };
    expect(await syncYappyUseCase(config, open)).toMatchObject({ ignored: 2, extracted: 0 });
    expect(calls.some((call) => call.name === 'ingest_yappy_payment')).toBe(false);
    expect(updates).toContainEqual(expect.objectContaining({ last_uid: 5 }));
  });
  it('does not advance a UID when ingestion fails', async () => {
    failIngest = true;
    await syncYappyUseCase(config, open);
    expect(updates).not.toContainEqual(expect.objectContaining({ last_uid: 4 }));
    expect(updates).toContainEqual({ last_error_code: 'sync_error' });
    expect(close).toHaveBeenCalledOnce();
  });
  it('ignores personal payments without storing a mail row in the route', async () => {
    outcome = 'ignorado';
    expect(await syncYappyUseCase(config, open)).toMatchObject({ ignored: 2, extracted: 0 });
    expect(calls.some((call) => call.name === 'record_invalid_yappy_mail')).toBe(false);
    expect(calls.filter((call) => call.name === 'ingest_yappy_payment')).toHaveLength(2);
  });
  it('keeps invalid parser output technical and advances its UID', async () => {
    readMail = { ...mail, text: 'invalid notice' };
    expect(await syncYappyUseCase(config, open)).toMatchObject({ invalid: 2 });
    expect(calls.filter((call) => call.name === 'record_invalid_yappy_mail')).toHaveLength(2);
    expect(calls.some((call) => call.name === 'ingest_yappy_payment')).toBe(false);
    expect(updates).toContainEqual(expect.objectContaining({ last_uid: 5 }));
  });
  it('filters forwarded and DMARC failed parsed mail through privacy RPC', async () => {
    readMail = { ...mail, subject: 'FW: Te enviaron por Yappy' };
    expect(await syncYappyUseCase(config, open)).toMatchObject({ discarded: 2 });
    expect(calls.find((call) => call.name === 'ingest_yappy_payment')?.args).toMatchObject({ p_reject_reason: 'reenviado', p_subject: null });
    calls.length = 0;
    readMail = { ...mail, dmarcPass: false };
    expect(await syncYappyUseCase(config, open)).toMatchObject({ invalid: 2 });
    expect(calls.find((call) => call.name === 'ingest_yappy_payment')?.args).toMatchObject({ p_reject_reason: 'dmarc_failed' });
  });
  it('caps each run at fifty and always closes the inbox', async () => {
    uids = Array.from({ length: 75 }, (_, index) => index + 4);
    expect(await syncYappyUseCase(config, open)).toMatchObject({ scanned: 50 });
    expect(read).toHaveBeenCalledTimes(50);
    expect(updates.filter((item) => 'last_uid' in item).at(-1)?.last_uid).toBe(53);
    expect(close).toHaveBeenCalledOnce();
  });
  it('records auth failure once and cron does not retry until manual sync', async () => {
    const error = Object.assign(new Error('secret must not be logged'), { authenticationFailed: true });
    open.mockRejectedValue(error);
    await syncYappyUseCase(config, open);
    expect(updates).toContainEqual({ last_error_code: 'auth_failed' });
    state.last_error_code = 'auth_failed';
    await syncYappyUseCase(config, open);
    expect(open).toHaveBeenCalledTimes(1);
    await syncYappyUseCase(config, open, true);
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('respects the atomic lock and skips foreign From after IMAP search', async () => {
    claimed = false;
    expect(await syncYappyUseCase(config, open)).toMatchObject({ deferred: 1 });
    expect(open).not.toHaveBeenCalled();
    claimed = true; readMail = null;
    expect(await syncYappyUseCase(config, open)).toMatchObject({ ignored: 2 });
    expect(calls.some((call) => call.name === 'ingest_yappy_payment')).toBe(false);
  });
  it('returns an empty summary for an empty search and counts duplicate confirmations', async () => {
    uids = [];
    expect(await syncYappyUseCase(config, open)).toMatchObject({ scanned: 0 });
    expect(updates).toContainEqual(expect.objectContaining({ last_synced_at: expect.any(String) }));
    uids = [4]; outcome = 'duplicado';
    expect(await syncYappyUseCase(config, open)).toMatchObject({ duplicate: 1, extracted: 0 });
  });
  it('propagates a failed claim and records a failed state read', async () => {
    failClaim = true;
    await expect(syncYappyUseCase(config, open)).rejects.toThrow('claim failed');
    expect(open).not.toHaveBeenCalled();
    failClaim = false; failState = true;
    await syncYappyUseCase(config, open);
    expect(updates).toContainEqual({ last_error_code: 'sync_error' });
    expect(open).not.toHaveBeenCalled();
  });
  it('reports an invalid UIDVALIDITY and still releases the lock when close fails', async () => {
    open.mockImplementationOnce(async (): Promise<YappyInbox> => ({ uidValidity: 0, search, read, close }));
    await syncYappyUseCase(config, open);
    expect(updates).toContainEqual({ last_error_code: 'sync_error' });
    close.mockRejectedValueOnce(new Error('close failed'));
    await syncYappyUseCase(config, open);
    expect(updates).toContainEqual({ sync_locked_until: null });
  });
});
