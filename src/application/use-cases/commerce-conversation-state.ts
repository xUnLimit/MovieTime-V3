import { z } from '@/platform/validation/zod';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotDefinition } from '@/types/bot';
import { resolveOption } from '@/modules/bot-config';
import { readBotAction } from '@/modules/whatsapp/bot-menu';

const itemSchema = z.object({ id: z.string().uuid(), name: z.string().max(200), amount: z.number().nonnegative(),
  currency: z.string().max(3), cycle: z.string().max(30) });
const replySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().max(4096) }),
  z.object({ kind: z.literal('buttons'), body: z.string().max(1024), buttons: z.array(z.object({ id: z.string().max(256), title: z.string().max(20) })).max(3) }),
  z.object({ kind: z.literal('list'), body: z.string().max(1024), buttonLabel: z.string().max(20),
    rows: z.array(z.object({ id: z.string().max(256), title: z.string().max(24), description: z.string().max(72).optional(), section: z.string().max(24).optional() })).max(10) }),
]);
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
});
export type CommerceItem = z.infer<typeof itemSchema>;
export type CommerceState = z.infer<typeof commerceStateSchema>;

export function commerceCommand(message: InboundMessage, definition?: BotDefinition | null): string | null {
  const payload = message.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && typeof payload.id === 'string'
    && message.messageType === 'interactive' && /^SHOP:[a-z0-9:_-]{1,100}$/i.test(payload.id)) return payload.id.slice(5);
  const action = readBotAction(message);
  if (action?.kind === 'option' && definition) {
    const resolved = resolveOption(definition, action.nodeId, action.optionId);
    // El bloque de catalogo del lienzo tiene la identidad fija de "comprar"; entra al mismo flujo de siempre.
    if (resolved?.target.action === 'purchase' || resolved?.target.block?.type === 'catalogo') return 'buy';
    if (resolved?.target.action === 'renewal') return 'renew';
    if (resolved?.target.action === 'my_services') return 'services';
  }
  if (message.messageType !== 'text') return null;
  const text = message.textBody?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
  const commands: Record<string, string> = { comprar: 'buy', catalogo: 'buy', adquirir: 'buy', renovar: 'renew',
    'mis servicios': 'services', carrito: 'summary', resumen: 'summary', confirmar: 'confirm',
    cancelar: 'cancel', ayuda: 'help', humano: 'help', hola: 'menu', menu: 'menu', estado: 'status', 'ya pague': 'paid' };
  return commands[text] ?? null;
}

export function commerceSummary(items: CommerceItem[]): string {
  return items.map((item, index) => `${index + 1}. ${item.name}${item.name.toLowerCase().includes(item.cycle.toLowerCase()) ? '' : ` (${item.cycle})`}: ${item.currency} ${item.amount.toFixed(2)}`).join('\n')
    + `\nTotal: ${items[0]?.currency ?? 'USD'} ${(items.reduce((total, item) => total + Math.round(item.amount * 100), 0) / 100).toFixed(2)}`;
}
export function commerceButtons(body: string, buttons: { id: string; title: string }[]): OutboundPayload {
  return { kind: 'buttons', body: body.slice(0, 1024), buttons: buttons.map(button => ({ ...button, id: `SHOP:${button.id}` })) };
}
