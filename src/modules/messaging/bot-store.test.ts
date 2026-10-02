import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: vi.fn(),
}));

import { createBotStore } from './bot-store';

type Result = { data?: unknown; count?: number | null; error?: { code: string } | null };

function fakeClient(results: Record<string, Result>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const result = { data: results[table]?.data ?? null, count: results[table]?.count ?? null, error: results[table]?.error ?? null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'neq', 'in', 'not', 'gte', 'like', 'order', 'limit']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => result;
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return builder;
    },
  };
  return { client: client as never, calls };
}

const waId = '50765331751';
const person = { id: 'p1' };
const netflix = (overrides: object = {}) => ({
  servicio_id: 's1', servicio_correo: 'Netflix008@movietimepty.top', perfil_nombre: 'Perfil 1',
  categoria_nombre: 'Netflix', servicio_nombre: 'Netflix Premium', ...overrides,
});

describe('createBotStore.customerServices', () => {
  it('returns the active Netflix accounts of exactly one customer, one per mailbox', async () => {
    const { client, calls } = fakeClient({
      terceros: { data: [person] },
      v_ventas_full: { data: [netflix(), netflix({ perfil_nombre: 'Perfil 2' }), netflix({ servicio_id: 's2', servicio_correo: 'x@y.test', categoria_nombre: 'Disney', servicio_nombre: 'Disney+' })] },
      servicios: { data: [{ id: 's1', activo: true }] },
    });
    await expect(createBotStore(client).customerServices(waId)).resolves.toEqual({
      known: true, clienteId: 'p1', services: [{ serviceId: 's1', email: 'netflix008@movietimepty.top', profiles: ['Perfil 1', 'Perfil 2'] }],
    });
    // The lookup uses the canonical terceros.wa_id column instead of scanning every customer.
    expect(calls).toContainEqual({ table: 'terceros', method: 'eq', args: ['wa_id', waId] });
    expect(calls).toContainEqual({ table: 'terceros', method: 'eq', args: ['active', true] });
    expect(calls).toContainEqual({ table: 'terceros', method: 'limit', args: [2] });
  });

  it('keeps each distinct profile noted on the customer sales, and none when they are blank', async () => {
    const { client } = fakeClient({
      terceros: { data: [person] },
      v_ventas_full: { data: [netflix({ perfil_nombre: ' Perfil 1 ' }), netflix({ perfil_nombre: 'Perfil 1' }), netflix({ perfil_nombre: '  ' }), netflix({ perfil_nombre: null })] },
      servicios: { data: [{ id: 's1', activo: true }] },
    });
    await expect(createBotStore(client).customerServices(waId)).resolves.toEqual({
      known: true, clienteId: 'p1', services: [{ serviceId: 's1', email: 'netflix008@movietimepty.top', profiles: ['Perfil 1'] }],
    });
    const blank = fakeClient({
      terceros: { data: [person] }, v_ventas_full: { data: [netflix({ perfil_nombre: null })] }, servicios: { data: [{ id: 's1', activo: true }] },
    });
    await expect(createBotStore(blank.client).customerServices(waId)).resolves.toEqual({
      known: true, clienteId: 'p1', services: [{ serviceId: 's1', email: 'netflix008@movietimepty.top', profiles: [] }],
    });
  });

  it('treats an unknown or shared number as not a customer', async () => {
    const unknown = { known: false, clienteId: null, services: [] };
    const none = fakeClient({ terceros: { data: [] } });
    await expect(createBotStore(none.client).customerServices(waId)).resolves.toEqual(unknown);
    const empty = fakeClient({ terceros: { data: null } });
    await expect(createBotStore(empty.client).customerServices(waId)).resolves.toEqual(unknown);
    const shared = fakeClient({ terceros: { data: [person, { id: 'p3' }] } });
    await expect(createBotStore(shared.client).customerServices(waId)).resolves.toEqual(unknown);
  });

  it('skips the lookup for a number that is not a canonical Panama wa_id', async () => {
    const foreign = fakeClient({ terceros: { data: [person] } });
    await expect(createBotStore(foreign.client).customerServices('15551234567'))
      .resolves.toEqual({ known: false, clienteId: null, services: [] });
    expect(foreign.calls).toEqual([]);
  });

  it('knows the customer but offers nothing without an active Netflix account', async () => {
    const noSales = fakeClient({ terceros: { data: [person] }, v_ventas_full: { data: [] } });
    await expect(createBotStore(noSales.client).customerServices(waId)).resolves.toEqual({ known: true, clienteId: 'p1', services: [] });
    const inactive = fakeClient({
      terceros: { data: [person] }, v_ventas_full: { data: [netflix(), netflix({ servicio_id: null }), netflix({ servicio_correo: '' })] },
      servicios: { data: [{ id: 's1', activo: false }] },
    });
    await expect(createBotStore(inactive.client).customerServices(waId)).resolves.toEqual({ known: true, clienteId: 'p1', services: [] });
  });

  it('fails loudly when a lookup fails', async () => {
    for (const failing of ['terceros', 'v_ventas_full', 'servicios']) {
      const { client } = fakeClient({
        terceros: { data: [person] }, v_ventas_full: { data: [netflix()] }, servicios: { data: [] },
        [failing]: { error: { code: 'XX000' } },
      });
      await expect(createBotStore(client).customerServices(waId)).rejects.toThrow('failed: XX000');
    }
  });
});

describe('createBotStore activity lookups', () => {
  it('returns the latest of the inbound and outbound activity, excluding the current message', async () => {
    const { client, calls } = fakeClient({
      whatsapp_inbound_messages: { data: { sent_at: '2026-10-02T10:00:00Z' } },
      whatsapp_outbound_messages: { data: { created_at: '2026-10-02T11:00:00Z' } },
    });
    await expect(createBotStore(client).lastActivityAt(waId, 'wamid.NOW')).resolves.toBe('2026-10-02T11:00:00Z');
    expect(calls).toContainEqual({ table: 'whatsapp_inbound_messages', method: 'neq', args: ['wa_message_id', 'wamid.NOW'] });
  });

  it('handles one-sided and empty history', async () => {
    const inboundOnly = fakeClient({ whatsapp_inbound_messages: { data: { sent_at: '2026-10-02T10:00:00Z' } } });
    await expect(createBotStore(inboundOnly.client).lastActivityAt(waId, 'x')).resolves.toBe('2026-10-02T10:00:00Z');
    const later = fakeClient({
      whatsapp_inbound_messages: { data: { sent_at: '2026-10-02T12:00:00Z' } },
      whatsapp_outbound_messages: { data: { created_at: '2026-10-02T09:00:00Z' } },
    });
    await expect(createBotStore(later.client).lastActivityAt(waId, 'x')).resolves.toBe('2026-10-02T12:00:00Z');
    await expect(createBotStore(fakeClient({}).client).lastActivityAt(waId, 'x')).resolves.toBeNull();
  });

  it('detects a recent operator reply by sent_by', async () => {
    const yes = fakeClient({ whatsapp_outbound_messages: { data: [{ id: 'o1' }] } });
    await expect(createBotStore(yes.client).operatorRepliedSince(waId, '2026-10-02T11:00:00Z')).resolves.toBe(true);
    expect(yes.calls).toContainEqual({ table: 'whatsapp_outbound_messages', method: 'not', args: ['sent_by', 'is', null] });
    const no = fakeClient({ whatsapp_outbound_messages: { data: [] } });
    await expect(createBotStore(no.client).operatorRepliedSince(waId, 'x')).resolves.toBe(false);
    await expect(createBotStore(fakeClient({}).client).operatorRepliedSince(waId, 'x')).resolves.toBe(false);
  });

  it('counts the menu taps in the window', async () => {
    const { client, calls } = fakeClient({ whatsapp_inbound_messages: { count: 3 } });
    await expect(createBotStore(client).menuTapsSince(waId, '2026-10-02T11:50:00Z')).resolves.toBe(3);
    expect(calls).toContainEqual({ table: 'whatsapp_inbound_messages', method: 'like', args: ['payload->>id', 'BOT:%'] });
    await expect(createBotStore(fakeClient({}).client).menuTapsSince(waId, 'x')).resolves.toBe(0);
  });

  it('fails loudly when an activity lookup fails', async () => {
    const error = { code: 'XX000' };
    await expect(createBotStore(fakeClient({ whatsapp_inbound_messages: { error } }).client).lastActivityAt(waId, 'x')).rejects.toThrow('XX000');
    await expect(createBotStore(fakeClient({ whatsapp_outbound_messages: { error } }).client).lastActivityAt(waId, 'x')).rejects.toThrow('XX000');
    await expect(createBotStore(fakeClient({ whatsapp_outbound_messages: { error } }).client).operatorRepliedSince(waId, 'x')).rejects.toThrow('XX000');
    await expect(createBotStore(fakeClient({ whatsapp_inbound_messages: { error } }).client).menuTapsSince(waId, 'x')).rejects.toThrow('XX000');
  });
});
