import { describe, expect, it, vi } from 'vitest';
import { defaultDefinitionV2 } from '@/modules/bot-config';
import type { NoticeGroup } from '@/modules/messaging/message-data';
import type { ConversationState } from '@/platform/validation/conversation-state';
import { createCodeWelcome } from './code-welcome';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-04T04:00:00Z');
const group: NoticeGroup = { clienteId: ID, clienteNombre: 'Ana', telefono: '60000000', fechaVencimiento: null, moneda: 'USD', ventas: [{
  ventaId: ID, clienteId: ID, clienteNombre: 'Ana', telefono: '60000000', categoriaNombre: 'Netflix', servicioNombre: 'Netflix', perfilNombre: 'Ana',
  accesoPorCodigo: true, correo: '', contrasena: '', codigo: '', fechaVencimiento: null, monto: 5, moneda: 'USD', activa: true, reembolsada: false,
  enReposo: false, promesaPagoHasta: null, respuestaCliente: null,
}] };
function setup(human = false) {
  const state: ConversationState = { flowVersion: 7, nodeId: 'menu', variables: {}, awaiting: null, owner: human ? 'humano' : 'bot' };
  const deps = { version: 7, definition: defaultDefinitionV2(),
    states: { load: vi.fn(async () => ({ state, revision: 1, updatedAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 86400_000).toISOString() })),
      compareAndSet: vi.fn(async () => true) },
    identity: { context: vi.fn(async () => ({ activeCategories: [], pendingOrder: false })), codeSale: vi.fn(async () => ({ serviceId: ID, email: 'a@example.test', profiles: ['Ana'] })), requestsSince: vi.fn(async () => 0) },
  };
  return { deps, welcome: createCodeWelcome(deps) };
}
describe('code welcome', () => {
  it('attaches an entity button and sets an awaiting sale only after acceptance', async () => {
    const { deps, welcome } = setup();
    const prepared = await welcome(group, '50760000000', { kind: 'text', text: 'Bienvenido' }, NOW, []);
    expect(prepared?.payload).toEqual({ kind: 'buttons', body: 'Bienvenido', buttons: [{ id: `BOT:CODE:${ID}`, title: 'Solicitar código' }] });
    expect(deps.states.compareAndSet).not.toHaveBeenCalled();
    await prepared?.accepted();
    expect(deps.states.compareAndSet).toHaveBeenCalledWith('50760000000', 1, expect.objectContaining({ variables: { solicitud_venta: ID }, awaiting: expect.objectContaining({ tipo: 'text', ref: 'menu' }) }), expect.any(String));
  });
  it('uses a CODE payload only on an existing approved template button', async () => {
    const { welcome } = setup();
    const payload = { kind: 'template' as const, templateName: 'welcome', params: [], buttonPayloads: ['DATOS:notice'] };
    expect(await welcome(group, '50760000000', payload, NOW, ['Recibir mis datos'])).toBeNull();
    const result = await welcome(group, '50760000000', payload, NOW, ['Solicitar código']);
    expect(result?.payload).toMatchObject({ buttonPayloads: [`BOT:CODE:${ID}`] });
  });
  it('respects human ownership and does not alter v1 or multi-sale welcomes', async () => {
    expect(await setup(true).welcome(group, '50760000000', { kind: 'text', text: 'Hola' }, NOW, [])).toBeNull();
    const { deps, welcome } = setup(); deps.definition.schemaVersion = 1;
    expect(await welcome(group, '50760000000', { kind: 'text', text: 'Hola' }, NOW, [])).toBeNull();
    deps.definition.schemaVersion = 2;
    expect(await welcome({ ...group, ventas: [...group.ventas, ...group.ventas] }, '50760000000', { kind: 'text', text: 'Hola' }, NOW, [])).toBeNull();
  });
});
