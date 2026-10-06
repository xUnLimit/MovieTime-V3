import { createLogger } from '@/platform/observability/logger';
import { accessListMessage } from '@/modules/whatsapp/bot-menu';
import { renderBotMessage, sayMessage } from './bot-messages';
import { reply, trackEvent, type AccessSale, type BotResult, type BotRun } from './bot-reply';

const log = createLogger('WhatsAppBot');
const MINUTE_MS = 60_000;
const MAX_TEXT = 4096;

async function unavailable(run: BotRun, motivo: string): Promise<BotResult> {
  await sayMessage(run, 'access_unavailable');
  await trackEvent(run, 'error', { detail: { motivo, destino: 'datos_acceso' } });
  return 'unavailable';
}

/**
 * La acción «Enviar mis datos de acceso»: el cliente recibe de nuevo lo que se le manda al crear su venta, solo de sus propios
 * servicios activos. Con varios servicios elige primero de cuál. `saleId` viene de una fila de esa lista y se vuelve a comprobar
 * contra las ventas del número que escribe: un identificador ajeno nunca devuelve datos.
 */
export async function requestServiceAccess(run: BotRun, saleId: string | null): Promise<BotResult> {
  const { deps, message, now } = run;
  const { params } = deps.definition;
  const taps = await deps.store.menuTapsSince(message.fromWaId, new Date(now.getTime() - params.tapWindowMinutes * MINUTE_MS).toISOString());
  if (taps > params.maxTaps) {
    await sayMessage(run, 'rate_limited', { minutos: String(params.tapWindowMinutes) });
    await trackEvent(run, 'rate_limited', { detail: { destino: 'datos_acceso', pulsaciones: taps } });
    return 'limited';
  }
  const port = deps.accessData;
  if (!port) return unavailable(run, 'datos_no_configurados');
  let sales: AccessSale[];
  try {
    sales = await port.eligible(message.fromWaId);
  } catch {
    log.warn('Access sales could not be read');
    return unavailable(run, 'datos_no_disponibles');
  }
  const chosen = saleId ? sales.find((sale) => sale.saleId === saleId) : sales.length === 1 ? sales[0] : undefined;
  if (sales.length === 0 || (saleId && !chosen)) {
    await sayMessage(run, 'access_none');
    await trackEvent(run, 'not_found', { detail: { destino: 'datos_acceso', motivo: 'sin_servicios' } });
    return 'none';
  }
  if (!chosen) {
    const list = accessListMessage(sales, {
      body: renderBotMessage(deps.definition, 'access_picker_body'), buttonLabel: renderBotMessage(deps.definition, 'access_picker_button'),
    });
    await reply(deps, message, list);
    await trackEvent(run, 'option_selected', { detail: { destino: 'elegir_servicio', servicios: sales.length } });
    return 'list';
  }
  let composed;
  try {
    composed = await port.compose(message.fromWaId, chosen.saleId);
  } catch {
    log.warn('Access data could not be prepared');
    return unavailable(run, 'datos_no_disponibles');
  }
  if (!composed) return unavailable(run, 'datos_no_disponibles');
  const notice = composed.withheld ? `\n\n${renderBotMessage(deps.definition, 'access_code_notice')}` : '';
  const sent = await reply(deps, message, { kind: 'text', text: `${composed.text}${notice}`.slice(0, MAX_TEXT), replyTo: message.waMessageId }, `${composed.stored}${notice}`.slice(0, MAX_TEXT));
  if (sent.sendStatus !== 'accepted') {
    await trackEvent(run, 'error', { detail: { motivo: 'envio_fallido', destino: 'datos_acceso' } });
    return 'send_failed';
  }
  await trackEvent(run, 'option_selected', { detail: { destino: 'datos_acceso' } });
  return 'access';
}
