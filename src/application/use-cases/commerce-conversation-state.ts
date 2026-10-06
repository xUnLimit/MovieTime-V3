import { z } from '@/platform/validation/zod';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';

const itemSchema = z.object({ id: z.string().uuid(), name: z.string().max(200), amount: z.number().nonnegative(),
  currency: z.string().max(3), cycle: z.string().max(30) });
const replySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().max(4096) }),
  z.object({ kind: z.literal('buttons'), body: z.string().max(1024), buttons: z.array(z.object({ id: z.string().max(256), title: z.string().max(20) })).max(3) }),
  z.object({ kind: z.literal('list'), body: z.string().max(1024), buttonLabel: z.string().max(20),
    rows: z.array(z.object({ id: z.string().max(256), title: z.string().max(24), description: z.string().max(72).optional(), section: z.string().max(24).optional() })).max(10) }),
]);
/**
 * Devolucion del turno al recorrido del bot: el aviso del flujo de compras (`text`) viaja con el nodo en un solo mensaje
 * (`prefixed`) o, si el destino es otro nodo de compra, se envia solo. `block`: bloque de compra que se abandona; su salida
 * de "cancelar" decide el destino.
 */
const handBackSchema = z.object({
  text: z.string().max(4096), prefixed: z.boolean(), block: z.enum(['catalogo', 'resumen', 'reserva', 'pago']).nullable(),
});
export type HandBack = z.infer<typeof handBackSchema>;

export const commerceStateSchema = z.object({
  stage: z.enum(['idle', 'buy', 'renew', 'summary', 'payment', 'last4', 'interest']).default('idle'),
  kind: z.enum(['buy', 'renew']).default('buy'), items: z.array(itemSchema).max(10).default([]),
  page: z.number().int().nonnegative().max(10000).default(0),
  orderId: z.string().uuid().nullable().default(null),
  interestPlanId: z.string().uuid().nullable().default(null),
  // Compra en dos pasos: plataforma con cupo y luego sus planes. `soldout` abre la lista de agotados.
  categoryId: z.string().uuid().nullable().default(null), soldout: z.boolean().default(false),
  lastMessageId: z.string().max(256).nullable().default(null), lastReply: z.string().max(4096).nullable().default(null),
  // Intentos con formato invalido al dar los ultimos 4 digitos; el limite real de coincidencias vive en SQL.
  last4Attempts: z.number().int().nonnegative().max(20).default(0),
  pendingHandoff: z.boolean().default(false),
  lastPayload: replySchema.nullable().default(null),
  // Si la ultima respuesta fue devolver el turno al recorrido, para repetirla igual si el mensaje se reentrega.
  lastHandBack: handBackSchema.nullable().default(null),
  // Ultima actividad del flujo de compras; con ella una seleccion abandonada deja de ocupar la conversacion.
  stageAt: z.string().max(40).nullable().default(null),
});
export type CommerceItem = z.infer<typeof itemSchema>;
export type CommerceState = z.infer<typeof commerceStateSchema>;

// Dentro de una etapa el cliente puede escribir estas palabras; en reposo el recorrido decide y ninguna entra al flujo de compras.
const STAGE_COMMANDS: Record<string, string> = { carrito: 'summary', resumen: 'summary', confirmar: 'confirm', cancelar: 'cancel',
  ayuda: 'help', humano: 'help', hola: 'menu', menu: 'menu', estado: 'status', 'ya pague': 'paid' };

/** Comando del flujo de compras: un boton `SHOP:` o, con una etapa en curso, una de sus palabras. Los toques del recorrido no lo son. */
export function commerceCommand(message: InboundMessage, stage: CommerceState['stage']): string | null {
  const payload = message.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && typeof payload.id === 'string'
    && message.messageType === 'interactive' && /^SHOP:[a-z0-9:_-]{1,100}$/i.test(payload.id)) return payload.id.slice(5);
  if (message.messageType !== 'text' || stage === 'idle') return null;
  const text = message.textBody?.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '';
  return STAGE_COMMANDS[text] ?? null;
}

/** Etapas de una compra todavia sin pedido: si el cliente las abandona, dejan de ocupar la conversacion. */
export const SHOPPING_STAGES: readonly CommerceState['stage'][] = ['buy', 'renew', 'summary', 'interest'];
export const DEFAULT_IDLE_HOURS = 12;
const HOUR_MS = 3_600_000;

/** Vuelve al reposo y suelta el carrito y el pedido enlazado (el pedido sigue en la base de datos). */
export function resetStage(state: CommerceState): void {
  Object.assign(state, { stage: 'idle', items: [], orderId: null, categoryId: null, soldout: false, page: 0, interestPlanId: null, last4Attempts: 0, stageAt: null });
}

/**
 * Una seleccion sin pedido que lleva mas de `idleHours` sin actividad se descarta. Un contexto guardado antes de existir
 * `stageAt` no se descarta: se le pone la hora actual.
 */
export function expireStage(state: CommerceState, idleHours: number, now: Date): void {
  if (!SHOPPING_STAGES.includes(state.stage)) return;
  const last = state.stageAt ? Date.parse(state.stageAt) : Number.NaN;
  if (Number.isNaN(last)) state.stageAt = now.toISOString();
  else if (now.getTime() - last >= idleHours * HOUR_MS) resetStage(state);
}

export function commerceButtons(body: string, buttons: { id: string; title: string }[]): OutboundPayload {
  return { kind: 'buttons', body: body.slice(0, 1024), buttons: buttons.map(button => ({ ...button, id: `SHOP:${button.id}` })) };
}
