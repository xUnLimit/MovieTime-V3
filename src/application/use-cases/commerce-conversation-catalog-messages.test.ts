import { describe, expect, it, vi } from 'vitest';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { defaultDefinition, setCatalogMessage } from '@/modules/bot-config';
import { handleCommerceConversation, type CommerceConversationDeps } from './commerce-conversation-use-case';

const NETFLIX = '123e4567-e89b-42d3-a456-426614174010';
const DISNEY = '123e4567-e89b-42d3-a456-426614174011';
const BASIC = '123e4567-e89b-42d3-a456-426614174001';
const PREMIUM = '123e4567-e89b-42d3-a456-426614174002';
const DISNEY_PLAN = '123e4567-e89b-42d3-a456-426614174003';
const waId = '50760000000';
let counter = 0;
const message = (text: string): InboundMessage => ({
  waMessageId: `wamid.${++counter}`, fromWaId: waId, phoneNumberId: '123', contactName: null, messageType: 'interactive', textBody: null,
  sentAt: '2026-10-03', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null,
  payload: { type: 'button_reply', id: `SHOP:${text}` },
});
const base = { moneda: 'USD', cicloPago: 'mensual' as const, perfilesLibres: 2 };
const catalogue = [
  { ...base, planId: BASIC, planNombre: 'Básico', categoriaId: NETFLIX, categoriaNombre: 'Netflix', precio: 4 },
  { ...base, planId: PREMIUM, planNombre: 'Premium', categoriaId: NETFLIX, categoriaNombre: 'Netflix', precio: 8 },
  { ...base, planId: DISNEY_PLAN, planNombre: 'Anual', categoriaId: DISNEY, categoriaNombre: 'Disney+', precio: 20 },
];
const deps = () => ({ catalogue: vi.fn().mockResolvedValue(catalogue), services: vi.fn().mockResolvedValue([]), buy: vi.fn(), renew: vi.fn(), order: vi.fn(),
  reconcile: vi.fn(), matchPayment: vi.fn(), interest: vi.fn(), cancelOrder: vi.fn(), paymentInstructions: null, now: () => new Date('2026-10-04T12:00:00Z') } as unknown as CommerceConversationDeps);

const definition = [
  (def: ReturnType<typeof defaultDefinition>) => setCatalogMessage(def, 'category', NETFLIX, 'rowDescription', 'Series y películas desde {{precio}}'),
  (def: ReturnType<typeof defaultDefinition>) => setCatalogMessage(def, 'category', NETFLIX, 'chosen', 'Bienvenido a {{plataforma}}. Elige tu plan.'),
  (def: ReturnType<typeof defaultDefinition>) => setCatalogMessage(def, 'plan', PREMIUM, 'rowDescription', '4 pantallas · {{precio}}'),
  (def: ReturnType<typeof defaultDefinition>) => setCatalogMessage(def, 'plan', PREMIUM, 'added', 'Premium: 4 pantallas en HD ({{ciclo}}).'),
].reduce((def, edit) => edit(def), defaultDefinition());

describe('mensajes propios por plataforma y plan en la conversación', () => {
  it('cada plataforma y plan dice lo suyo y el resto usa el texto general', async () => {
    const dependencies = deps();
    const platforms = await handleCommerceConversation(message('buy'), {}, dependencies, definition);
    const rows = (platforms!.payload as { rows: { id: string; title: string; description: string }[] }).rows;
    expect(rows.find(row => row.title === 'Netflix')?.description).toBe('Series y películas desde USD 4.00');
    expect(rows.find(row => row.title === 'Disney+')?.description).toBe('1 plan · desde USD 20.00');

    const netflix = await handleCommerceConversation(message(`cat:${NETFLIX}`), platforms!.context, dependencies, definition);
    const plans = netflix!.payload as { body: string; rows: { title: string; description: string }[] };
    expect(plans.body).toBe('Bienvenido a Netflix. Elige tu plan.');
    expect(plans.rows.find(row => row.title === 'Premium')?.description).toBe('4 pantallas · USD 8.00');
    expect(plans.rows.find(row => row.title === 'Básico')?.description).toBe('USD 4.00 · mensual');

    const premium = await handleCommerceConversation(message(`add:${PREMIUM}`), netflix!.context, dependencies, definition);
    expect((premium!.payload as { body: string }).body).toContain('Premium: 4 pantallas en HD (mensual).');
    const basic = await handleCommerceConversation(message(`add:${BASIC}`), premium!.context, dependencies, definition);
    expect((basic!.payload as { body: string }).body).toContain('agregué Netflix Básico');
  });

  it('sin definición o con un texto inválido el bot usa el texto general', async () => {
    const dependencies = deps();
    const bad = setCatalogMessage(defaultDefinition(), 'category', NETFLIX, 'rowDescription', 'Mal {{pedido}}');
    for (const def of [undefined, bad]) {
      const platforms = await handleCommerceConversation(message('buy'), {}, dependencies, def);
      const rows = (platforms!.payload as { rows: { title: string; description: string }[] }).rows;
      expect(rows.find(row => row.title === 'Netflix')?.description).toBe('2 planes · desde USD 4.00');
    }
  });
});
