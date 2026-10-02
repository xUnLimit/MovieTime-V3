import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { openYappyInbox, UnreadableYappyMailError, type YappyInbox, type YappyInboxMail } from '@/platform/server/yappy-imap';
import { parseYappyMail, YAPPY_PARSER_VERSION } from '@/modules/yappy/parse-mail';
import { createLogger } from '@/platform/observability/logger';
import { z } from '@/platform/validation/zod';
import { createPedidoPaymentRepository } from '@/platform/supabase/pedido-payment-repository';
import { retryPendingReceipts } from './pedido-payment-use-cases';

type Config = { user: string; password: string };
type Counts = { scanned: number; extracted: number; invalid: number; duplicate: number; discarded: number; ignored: number; deferred: number; errorCode: string | null };
const logger = createLogger('YappySync');
const maxMessages = 50;
const maxRunMs = 240_000;
const resultSchema = z.object({ outcome: z.enum(['ignorado', 'nuevo', 'duplicado']), payment_id: z.string().uuid().nullable(),
  match_status: z.string().nullable() });
const stateSchema = z.object({ mailbox: z.string(), uid_validity: z.number().int().positive().nullable(),
  last_uid: z.number().int().nonnegative(), last_error_code: z.string().nullable() });

// Tras cada sincronizacion con pagos nuevos se reintentan los comprobantes que esperaban el correo.
async function retryReceiptsAfterSync(): Promise<void> {
  await retryPendingReceipts({ repository: createPedidoPaymentRepository(createServiceRoleClient()), newKey: () => crypto.randomUUID() });
}

function isAuthFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? error.code : null;
  const serverCode = 'serverResponseCode' in error ? error.serverResponseCode : null;
  return ('authenticationFailed' in error && error.authenticationFailed === true) ||
    code === 'AUTHENTICATIONFAILED' || code === 'EAUTH' || code === 'AUTH_FAILED' ||
    serverCode === 'AUTHENTICATIONFAILED';
}

async function readMail(inbox: YappyInbox, uid: number, validity: number, counts: Counts): Promise<YappyInboxMail | null | 'skipped'> {
  try {
    return await inbox.read(uid);
  } catch (error) {
    if (!(error instanceof UnreadableYappyMailError)) throw error;
    const { error: recordError } = await createServiceRoleClient().rpc('record_invalid_yappy_mail', {
      p_uid_validity: validity, p_imap_uid: uid, p_received_at: error.receivedAt,
      p_parser_version: YAPPY_PARSER_VERSION, p_failure_reason: 'mime_invalid',
    });
    if (recordError) throw recordError;
    counts.scanned++;
    counts.invalid++;
    return 'skipped';
  }
}

async function processMail(inbox: YappyInbox, uid: number, validity: number, counts: Counts, cutoff: number | null): Promise<void> {
  const db = createServiceRoleClient();
  const mail = await readMail(inbox, uid, validity, counts);
  if (mail === 'skipped') return;
  if (!mail) { counts.ignored++; return; }
  if (cutoff !== null && Date.parse(mail.receivedAt) < cutoff) { counts.ignored++; return; }
  counts.scanned++;
  const forwarded = /^\s*(?:re|fw|rv|fwd)\s*:/i.test(mail.subject);
  const parsed = parseYappyMail(mail.text);
  if (!parsed.ok) {
    const { error } = await db.rpc('record_invalid_yappy_mail', {
      p_uid_validity: validity, p_imap_uid: uid, p_received_at: mail.receivedAt,
      p_parser_version: YAPPY_PARSER_VERSION, p_failure_reason: forwarded ? 'reenviado' : parsed.reason,
    });
    if (error) throw error;
    if (forwarded) counts.discarded++;
    else counts.invalid++;
    return;
  }
  const rejectReason = mail.dmarcPass === false ? 'dmarc_failed' : forwarded ? 'reenviado' : null;
  const { data, error } = await db.rpc('ingest_yappy_payment', {
    p_uid_validity: validity, p_imap_uid: uid, p_internet_message_id: mail.messageId,
    p_received_at: mail.receivedAt, p_subject: rejectReason ? null : mail.subject, p_dmarc_pass: mail.dmarcPass,
    p_parser_version: YAPPY_PARSER_VERSION, p_confirmation_code: parsed.payment.confirmationCode,
    p_amount: parsed.payment.amount, p_payer_name_short: parsed.payment.payerNameShort,
    p_payer_phone_last4: parsed.payment.payerPhoneLast4, p_paid_at: parsed.payment.paidAt,
    p_reject_reason: rejectReason,
  });
  if (error) throw error;
  const result = resultSchema.parse(data?.[0]);
  if (result.outcome === 'ignorado') counts.ignored++;
  else if (result.outcome === 'duplicado') counts.duplicate++;
  else if (rejectReason === 'dmarc_failed') counts.invalid++;
  else if (forwarded) counts.discarded++;
  else counts.extracted++;
}

export async function syncYappyUseCase(
  config: Config, openInbox = openYappyInbox, retryAuth = false, afterSync: () => Promise<void> = retryReceiptsAfterSync,
): Promise<Counts> {
  const db = createServiceRoleClient();
  const counts: Counts = { scanned: 0, extracted: 0, invalid: 0, duplicate: 0, discarded: 0, ignored: 0, deferred: 0, errorCode: null };
  const { data: claimed, error: claimError } = await db.rpc('claim_yappy_mail_sync');
  if (claimError) throw claimError;
  if (!claimed) return { ...counts, deferred: 1 };
  let inbox: YappyInbox | null = null;
  try {
    const { data: state, error: stateError } = await db.from('yappy_mail_sync_state')
      .select('mailbox,uid_validity,last_uid,last_error_code').eq('id', true).single();
    if (stateError || !state) throw stateError ?? new Error('Missing IMAP sync state');
    const typedState = stateSchema.parse(state);
    // Invalid app passwords require operator action, not repeated cron login attempts.
    if (typedState.last_error_code === 'auth_failed' && !retryAuth) return { ...counts, errorCode: 'auth_failed' };
    inbox = await openInbox(config.user, config.password);
    if (!Number.isSafeInteger(inbox.uidValidity) || inbox.uidValidity <= 0) throw new Error('Invalid UIDVALIDITY');
    const reset = typedState.uid_validity !== inbox.uidValidity || typedState.mailbox !== config.user;
    const lastUid = reset ? 0 : typedState.last_uid;
    if (reset) {
      const { error } = await db.from('yappy_mail_sync_state').update({ uid_validity: inbox.uidValidity,
        last_uid: 0, mailbox: config.user, last_error_code: null }).eq('id', true);
      if (error) throw error;
    }
    const since = reset ? new Date(Date.now() - 7 * 24 * 60 * 60_000) : null;
    const uids = await inbox.search(lastUid, since);
    const started = Date.now();
    for (const uid of uids.slice(0, maxMessages)) {
      if (Date.now() - started > maxRunMs) break;
      await processMail(inbox, uid, inbox.uidValidity, counts, since?.getTime() ?? null);
      const { error } = await db.from('yappy_mail_sync_state').update({ last_uid: uid,
        last_synced_at: new Date().toISOString(), last_error_code: null, mailbox: config.user }).eq('id', true);
      if (error) throw error;
    }
    if (uids.length === 0) {
      const { error } = await db.from('yappy_mail_sync_state').update({ last_synced_at: new Date().toISOString(),
        last_error_code: null, mailbox: config.user }).eq('id', true);
      if (error) throw error;
    }
  } catch (error) {
    const failureCode = isAuthFailure(error) ? 'auth_failed' : 'sync_error';
    counts.errorCode = failureCode;
    logger.warn('Yappy IMAP synchronization failed', { errorCode: failureCode });
    const { error: updateError } = await db.from('yappy_mail_sync_state').update({ last_error_code: failureCode }).eq('id', true);
    if (updateError) throw updateError;
  } finally {
    if (inbox) {
      try { await inbox.close(); }
      catch { logger.warn('Could not close Yappy IMAP connection', { errorCode: 'imap_close_failed' }); }
    }
    const { error } = await db.from('yappy_mail_sync_state').update({ sync_locked_until: null }).eq('id', true);
    if (error) logger.warn('Could not release Yappy sync lock', { errorCode: error.code });
  }
  if (counts.extracted > 0) {
    try { await afterSync(); }
    catch { logger.warn('Pending receipt retry failed after Yappy sync', { errorCode: 'receipt_retry_failed' }); }
  }
  return counts;
}
