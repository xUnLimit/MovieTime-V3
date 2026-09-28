import { randomUUID } from 'node:crypto';
import { buildMessageData, groupNoticeVentas, isNoticeEligible, metaParamsFromMap,
  normalizePanamaWaId, noticeDedupeKey, renderFreeText, type NoticeGroup, type NoticeVenta } from '@/modules/messaging/message-data';
import type { NoticeStore, NoticeTipo } from '@/modules/messaging/notice-store';
import { isWindowOpen, type OutboundResult } from '@/modules/whatsapp/outbound-messages';
import { WHATSAPP_TEMPLATE_LANGUAGE, type TemplateCatalog } from '@/modules/whatsapp/template-catalog';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';

export type SendNoticeInput = {
  tipo: NoticeTipo; ventaIds: string[]; origin: 'manual' | 'auto'; sentBy: string | null; now: Date;
};
export type NoticeResult = {
  noticeId: string | null; clienteNombre: string; ventaIds: string[];
  status: 'accepted' | 'already_sent' | 'failed' | 'skipped' | 'uncertain' | 'wa_me';
  channel: 'template' | 'text' | 'wa_me' | null;
  waMeText?: string; waId: string | null; error?: string;
};
export type SendNoticeDeps = {
  store: NoticeStore; catalog: TemplateCatalog;
  send: (message: { idempotencyKey: string; toWaId: string; payload: OutboundPayload; sentBy: string | null }) => Promise<OutboundResult>;
};

const TEMPLATE_TYPES: readonly NoticeTipo[] = [
  'notificacion_regular', 'dia_pago', 'cancelacion', 'actualizacion_credenciales', 'transferencia_servicio',
];
const UNSAFE_META_KEYS = new Set(['contrasena', 'correo', 'codigo']);
const PANAMA_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Panama',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric',
  minute: 'numeric', second: 'numeric', hourCycle: 'h23',
});
function day(value: Date | null): string | null {
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function panamaWallClock(now: Date): Date {
  const parts = PANAMA_CLOCK.formatToParts(now);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  return new Date(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
}
function skipReason(venta: NoticeVenta): string {
  if (venta.respuestaCliente) return 'no_continuar';
  if (venta.reembolsada) return 'reembolsada';
  if (venta.enReposo) return 'en_reposo';
  if (!venta.activa) return 'inactiva';
  return 'promesa_pago';
}
function actionFor(text: string, index: number): string {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (normalized === 'quiero renovar') return 'RENOVAR';
  if (normalized === 'no deseo continuar') return 'NO_CONTINUAR';
  if (normalized === 'recibir mis datos') return 'DATOS';
  return `BTN${index}`;
}
async function recordSkipped(group: NoticeGroup, input: SendNoticeInput, deps: SendNoticeDeps,
  reason: string, normalizedWaId: string | null): Promise<NoticeResult> {
  const ventaIds = group.ventas.map((venta) => venta.ventaId);
  const idempotencyKey = randomUUID();
  const record = await deps.store.reserve({
    dedupeKey: noticeDedupeKey(input.tipo, group.clienteId, group.fechaVencimiento, ventaIds),
    tipo: input.tipo, terceroId: group.clienteId, waId: normalizedWaId ?? group.telefono.trim(),
    channel: 'text', metaTemplateName: null, fechaVencimiento: day(group.fechaVencimiento),
    origin: input.origin, idempotencyKey, createdBy: input.sentBy, ventaIds,
  });
  if (record.idempotency_key === idempotencyKey) {
    await deps.store.finish(record.id, 'skipped', null, null, reason);
  }
  return { noticeId: record.id, clienteNombre: group.clienteNombre, ventaIds,
    status: 'skipped', channel: null, waId: normalizedWaId, error: reason };
}

async function sendGroup(group: NoticeGroup, input: SendNoticeInput, deps: SendNoticeDeps): Promise<NoticeResult> {
  const ventaIds = group.ventas.map((venta) => venta.ventaId);
  const base = { noticeId: null, clienteNombre: group.clienteNombre, ventaIds, waId: null };
  const waId = normalizePanamaWaId(group.telefono);
  if (!waId) return recordSkipped(group, input, deps, 'telefono_invalido', null);
  if (await deps.store.isAmbiguousPhone(waId, group.clienteId)) {
    return recordSkipped(group, input, deps, 'telefono_ambiguo', waId);
  }
  const template = await deps.store.loadTemplate(input.tipo);
  if (!template) return recordSkipped(group, input, deps, 'plantilla_no_configurada', waId);
  const data = buildMessageData(group, { now: panamaWallClock(input.now) });
  const freeText = renderFreeText(template.contenido, data);
  const waMe = (): NoticeResult => ({ ...base, waId, status: 'wa_me', channel: 'wa_me', waMeText: freeText });
  let payload: OutboundPayload;
  let channel: 'template' | 'text';
  let buttonTexts: string[] = [];
  if (TEMPLATE_TYPES.includes(input.tipo)) {
    const metaName = template.metaTemplateName;
    if (!metaName) return input.origin === 'auto'
      ? recordSkipped(group, input, deps, 'plantilla_no_aprobada', waId) : waMe();
    const approved = await deps.catalog.getApproved(metaName, WHATSAPP_TEMPLATE_LANGUAGE);
    if (!approved || template.metaParamMap.some((key) => UNSAFE_META_KEYS.has(key))) return input.origin === 'auto'
      ? recordSkipped(group, input, deps, 'plantilla_no_aprobada', waId) : waMe();
    let params: string[];
    try { params = metaParamsFromMap(template.metaParamMap, data); }
    catch { return input.origin === 'auto'
      ? recordSkipped(group, input, deps, 'plantilla_no_aprobada', waId) : waMe(); }
    if (params.length !== approved.paramCount || approved.buttons.some((button) => button.type !== 'QUICK_REPLY')) return input.origin === 'auto'
      ? recordSkipped(group, input, deps, 'plantilla_no_aprobada', waId) : waMe();
    channel = 'template';
    buttonTexts = approved.buttons.map((button) => button.text);
    // The notice ID is needed in button payloads, so payload is completed after reservation.
    payload = { kind: 'template', templateName: metaName, params };
  } else {
    if (!isWindowOpen(await deps.store.lastInboundAt(waId), input.now)) return waMe();
    channel = 'text';
    payload = { kind: 'text', text: freeText };
  }
  const idempotencyKey = randomUUID();
  const record = await deps.store.reserve({
    dedupeKey: noticeDedupeKey(input.tipo, group.clienteId, group.fechaVencimiento, ventaIds),
    tipo: input.tipo, terceroId: group.clienteId, waId, channel,
    metaTemplateName: channel === 'template' ? template.metaTemplateName : null,
    fechaVencimiento: day(group.fechaVencimiento), origin: input.origin,
    idempotencyKey, createdBy: input.sentBy, ventaIds,
  });
  const common = { ...base, noticeId: record.id, waId, channel, waMeText: freeText };
  if (record.idempotency_key !== idempotencyKey) {
    if (record.status === 'accepted') return { ...common, status: 'already_sent' };
    if (record.status === 'failed') return { ...common, status: 'failed', error: 'reintento_manual_requerido' };
    return { ...common, status: 'uncertain', error: record.status === 'pending'
      && input.now.getTime() - new Date(record.created_at).getTime() > 10 * 60_000 ? 'pending_may_be_sent' : 'already_pending' };
  }
  if (payload.kind === 'template') {
    payload = { ...payload, buttonPayloads: buttonTexts.map((button, index) => `${actionFor(button, index)}:${record.id}`) };
  }
  let result: OutboundResult;
  try { result = await deps.send({ idempotencyKey, toWaId: waId, payload, sentBy: input.sentBy }); }
  catch { return { ...common, status: 'uncertain', error: 'envio_incierto' }; }
  if (result.sendStatus === 'pending') return { ...common, status: 'uncertain', error: 'envio_incierto' };
  await deps.store.finish(record.id, result.sendStatus, result.id, result.waMessageId);
  return result.sendStatus === 'accepted' ? { ...common, status: 'accepted' }
    : { ...common, status: 'failed', error: 'envio_fallido' };
}

export async function sendNotice(input: SendNoticeInput, deps: SendNoticeDeps): Promise<NoticeResult[]> {
  const requestedIds = [...new Set(input.ventaIds)];
  const loaded = await deps.store.loadVentas(requestedIds);
  const byId = new Map(loaded.map((venta) => [venta.ventaId, venta]));
  const today = panamaWallClock(input.now);
  const skipped: NoticeResult[] = [];
  for (const id of requestedIds) {
    const venta = byId.get(id);
    if (venta && isNoticeEligible(venta, today)) continue;
    if (venta) {
      const group = groupNoticeVentas([venta])[0];
      skipped.push(await recordSkipped(group, input, deps, skipReason(venta), normalizePanamaWaId(venta.telefono)));
    } else {
      skipped.push({ noticeId: null, clienteNombre: '', ventaIds: [id],
        status: 'skipped', channel: null, waId: null, error: 'venta_no_encontrada' });
    }
  }
  const eligible = loaded.filter((venta) => isNoticeEligible(venta, today));
  const groups = groupNoticeVentas(eligible);
  const results: NoticeResult[] = [];
  for (const group of groups) results.push(await sendGroup(group, input, deps));
  return [...skipped, ...results];
}
