import { createHash } from 'node:crypto';

import { createLogger } from '@/platform/observability/logger';
import type { NetflixInbox } from '@/platform/server/netflix-imap';
import type { BotService } from '@/modules/messaging/bot-store';
import type { DatedCodeMail as DatedNetflixMail } from '@/modules/code-providers';
import { getCodeProvider } from '@/modules/code-providers';
import { accountListMessage, BOT_STORED_TEXT, type BotCodeType } from '@/modules/whatsapp/bot-menu';
import { messageWithRetryButton, renderBotMessage, sayMessage } from './bot-messages';
import { reply, trackEvent, type BotResult, type BotRun } from './bot-reply';

const log = createLogger('WhatsAppBot');
const MINUTE_MS = 60_000;
function netflixProvider() {
  const provider = getCodeProvider('netflix');
  if (!provider) throw new Error('Netflix provider is not registered');
  return provider;
}

type Candidate = { service: BotService; item: DatedNetflixMail; key: string };
type Found = { candidates: Candidate[]; blocked: number };
type Sent = { result: 'code' | 'link'; accepted: boolean };

// Netflix mails carry no stable id of their own beyond Message-ID; without it the
// account and the arrival time still tell two mails apart.
function mailKey(item: DatedNetflixMail): string {
  return createHash('sha256').update(item.messageId ?? `${item.mail.accountEmail}|${item.receivedAt}`).digest('hex');
}

async function readRecentMails(inbox: NetflixInbox, since: Date): Promise<DatedNetflixMail[]> {
  const mails: DatedNetflixMail[] = [];
  for (const raw of await inbox.recent(since)) {
    const mail = netflixProvider().parse(raw);
    if (mail) mails.push({ receivedAt: raw.receivedAt, messageId: raw.messageId, mail });
  }
  return mails;
}

// null when the mailbox cannot be read. blocked counts the travel requests that belong to another profile.
async function findCandidates(
  run: BotRun, eligible: BotService[], type: BotCodeType, windowMs: number,
): Promise<Found | null> {
  const kind = type === 'login' ? 'login_code' : 'travel_link';
  try {
    const inbox = await run.deps.openInbox();
    if (!inbox) throw new Error('Netflix mailbox is not configured');
    let mails: DatedNetflixMail[];
    try {
      mails = await readRecentMails(inbox, new Date(run.now.getTime() - windowMs - MINUTE_MS));
    } finally {
      try {
        await inbox.close();
      } catch {
        log.warn('Netflix mailbox did not close cleanly');
      }
    }
    const byAccount = netflixProvider().recentMails(mails, new Set(eligible.map((service) => service.email)), kind, run.now, windowMs);
    let blocked = 0;
    const candidates = eligible.flatMap((service) => (byAccount.get(service.email) ?? [])
      // A travel request belongs to the profile that made it; sign-in mails do not say who asked.
      .filter(({ mail }) => {
        const mine = netflixProvider().belongsTo(mail, service, service);
        if (!mine) blocked += 1;
        return mine;
      })
      .map((item) => ({ service, item, key: mailKey(item) })));
    return { candidates, blocked };
  } catch {
    log.warn('Netflix mailbox could not be read');
    return null;
  }
}

async function sendText(
  run: BotRun, text: string, stored: string, result: Sent['result'],
): Promise<Sent> {
  const sent = await reply(run.deps, run.message, { kind: 'text', text, replyTo: run.message.waMessageId }, stored);
  return { result, accepted: sent.sendStatus === 'accepted' };
}

async function sendCode(run: BotRun, item: DatedNetflixMail, minutes: string): Promise<Sent> {
  const provider = netflixProvider();
  const mail = item.mail;
  let travelCode: string | null = null;
  if (mail.kind === 'travel_link') {
    try {
      const page = await run.deps.fetchTravelPage(mail.verifyUrl);
      travelCode = page ? provider.parseTravelPage(page) : null;
    } catch {
      log.warn('Netflix travel page could not be read');
    }
  }
  const delivery = provider.formatDelivery(mail, { minutes, travelCode });
  return sendText(run, renderBotMessage(run.deps.definition, delivery.message, delivery.values),
    delivery.result === 'code' ? BOT_STORED_TEXT.code : BOT_STORED_TEXT.link, delivery.result);
}

async function releaseQuietly(run: BotRun, key: string): Promise<void> {
  try {
    await run.deps.claims.release(key, run.message.fromWaId);
  } catch {
    log.warn('Netflix code claim could not be released');
  }
}

// Asks the customer to request the code in Netflix and tap the same button again.
async function sayNotFound(run: BotRun, type: BotCodeType, minutes: string, profiles: string[]): Promise<void> {
  const text = renderBotMessage(run.deps.definition, type === 'login' ? 'login_not_found' : 'travel_not_found', {
    minutos: minutes, perfil: profiles.slice(0, 3).join(', '),
  });
  const action = type === 'login' ? 'netflix_login_code' : 'netflix_travel_code';
  await reply(run.deps, run.message, messageWithRetryButton(run.deps.definition, action, text));
}

// The mail belongs to this customer from the claim on; if the message never reached
// WhatsApp the claim is returned so that he can ask again.
async function claimAndSend(
  run: BotRun, candidate: Candidate, type: BotCodeType, minutes: string, profiles: string[],
): Promise<BotResult> {
  const claim = await run.deps.claims.claim(candidate.key, run.message.fromWaId);
  if (claim === 'mine') {
    await sayMessage(run, 'already_sent');
    await trackEvent(run, 'already_sent', { detail: { tipo: type, cuenta: candidate.service.email } });
    return 'already_sent';
  }
  if (claim === 'taken') {
    await sayNotFound(run, type, minutes, profiles);
    await trackEvent(run, 'not_found', { detail: { tipo: type, motivo: 'entregado_a_otro' } });
    return 'retry';
  }
  let sent: Sent;
  try {
    sent = await sendCode(run, candidate.item, minutes);
  } catch (error) {
    await releaseQuietly(run, candidate.key);
    throw error;
  }
  if (!sent.accepted) {
    await releaseQuietly(run, candidate.key);
    await trackEvent(run, 'error', { detail: { motivo: 'envio_fallido', tipo: type } });
    return 'send_failed';
  }
  const detail = { tipo: type, cuenta: candidate.service.email, perfil: candidate.item.mail.kind === 'travel_link' ? candidate.item.mail.profileName : null };
  await trackEvent(run, sent.result === 'code' ? 'code_sent' : 'link_sent', { detail });
  return sent.result;
}

async function alreadySent(run: BotRun, type: BotCodeType): Promise<BotResult> {
  await sayMessage(run, 'already_sent');
  await trackEvent(run, 'already_sent', { detail: { tipo: type } });
  return 'already_sent';
}

// No free mail: either none arrived, another customer already has it, or it belongs to another profile.
async function nothingToDeliver(
  run: BotRun, found: Found, type: BotCodeType, minutes: string, profiles: string[],
): Promise<BotResult> {
  await sayNotFound(run, type, minutes, profiles);
  if (found.candidates.length === 0 && found.blocked > 0) {
    await trackEvent(run, 'profile_blocked', { detail: { tipo: type, motivo: 'otro_perfil', solicitudes: found.blocked } });
  } else {
    const motivo = found.candidates.length === 0 ? 'sin_correo' : 'entregado_a_otro';
    await trackEvent(run, 'not_found', { detail: { tipo: type, motivo } });
  }
  return 'retry';
}

export async function requestNetflixCode(
  run: BotRun, services: BotService[], request: { type: BotCodeType; serviceId: string | null },
): Promise<BotResult> {
  const { deps, message, now } = run;
  const { params } = deps.definition;
  const { type } = request;
  const windowMinutes = type === 'login' ? params.loginWindowMinutes : params.travelWindowMinutes;
  const minutes = String(windowMinutes);
  const taps = await deps.store.menuTapsSince(message.fromWaId, new Date(now.getTime() - params.tapWindowMinutes * MINUTE_MS).toISOString());
  if (taps > params.maxTaps) {
    await sayMessage(run, 'rate_limited', { minutos: String(params.tapWindowMinutes) });
    await trackEvent(run, 'rate_limited', { detail: { tipo: type, pulsaciones: taps } });
    return 'limited';
  }
  const owned = request.serviceId ? services.filter((service) => service.serviceId === request.serviceId) : services;
  const supported = owned.filter((service) => !service.providerKey || service.providerKey === 'netflix');
  if (supported.length === 0) {
    await sayMessage(run, 'no_netflix_account');
    await trackEvent(run, 'not_found', { detail: { tipo: type, motivo: 'sin_cuenta' } });
    return 'none';
  }
  // Without a noted profile a travel request cannot be matched to this customer, so nothing is delivered.
  const eligible = type === 'travel' ? supported.filter((service) => service.profiles.length > 0) : supported;
  if (eligible.length === 0) {
    await sayMessage(run, 'profile_missing');
    await trackEvent(run, 'profile_blocked', { detail: { tipo: type, motivo: 'sin_perfil' } });
    return 'no_profile';
  }
  const found = await findCandidates(run, eligible, type, windowMinutes * MINUTE_MS);
  if (!found) {
    await sayMessage(run, 'mailbox_unavailable');
    await trackEvent(run, 'mailbox_unavailable', { detail: { tipo: type } });
    return 'unavailable';
  }
  const { candidates } = found;
  const profiles = type === 'travel' ? [...new Set(eligible.flatMap((service) => service.profiles))] : [];
  const owners = await deps.claims.owners(candidates.map((candidate) => candidate.key));
  const free = candidates.filter((candidate) => !owners.has(candidate.key));
  if (free.length === 0) {
    const delivered = candidates.some((candidate) => owners.get(candidate.key) === message.fromWaId);
    return delivered ? alreadySent(run, type) : nothingToDeliver(run, found, type, minutes, profiles);
  }
  const accounts = [...new Map(free.map((candidate) => [candidate.service.email, candidate.service])).values()];
  if (accounts.length > 1) {
    await reply(run.deps, message, accountListMessage(accounts, type, {
      body: renderBotMessage(deps.definition, 'account_picker_body'),
      buttonLabel: renderBotMessage(deps.definition, 'account_picker_button'),
    }));
    await trackEvent(run, 'menu_shown', { detail: { motivo: 'elegir_cuenta', tipo: type, cuentas: accounts.length } });
    return 'list';
  }
  // Several free mails of one account: the newest is the one just requested.
  return claimAndSend(run, free[0], type, minutes, profiles);
}
