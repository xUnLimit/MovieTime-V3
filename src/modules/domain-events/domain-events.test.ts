import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { createDomainEventStore } from './domain-event-store';
import { DOMAIN_EVENT_SCHEMAS, parseDomainEvent, type RawDomainEvent } from './event-schemas';

function raw(type: string, payload: unknown): RawDomainEvent {
  return { id: 'e1', type, aggregateType: 'venta', aggregateId: 'v1', payload, occurredAt: '2026-10-03T12:00:00Z', attempts: 1 };
}

describe('parseDomainEvent', () => {
  it('accepts every registered type with a valid payload', () => {
    const payloads: Record<keyof typeof DOMAIN_EVENT_SCHEMAS, unknown> = {
      'venta.creada': { venta_id: 'v1', cliente_id: null, servicio_id: 's1', categoria_id: 'c1', estado: 'activo' },
      'venta.pago_registrado': { venta_id: 'v1', pago_id: 'p1', periodo_id: 'pe1', numero_periodo: 2, total_usd: 5, moneda_original: 'USD' },
      'venta.reembolsada': { venta_id: 'v1', pago_id: 'p1', periodo_id: 'pe1', monto_usd: 5, moneda_original: 'USD', cortada: false },
      'venta.transferida': { venta_id: 'v1', from_servicio_id: 's1', to_servicio_id: 's2' },
      'servicio.credenciales_cambiadas': { servicio_id: 's1', correo_cambiado: false, contrasena_cambiada: true },
      'yappy.pago_detectado': { payment_id: 'y1', match_status: 'match_unico', amount: 5 },
      'yappy.pago_resuelto': { payment_id: 'y1', venta_id: 'v1', amount: 5, resolved_by: null },
      'pedido.pago_reclamado': { pedido_id: 'p1', payment_id: 'y1', resultado: 'confirmado', monto: 5, faltante: 0, estado: 'entregado' },
      'pedido.pago_en_revision': { pedido_id: 'p1', motivo: 'monto_menor', faltante: 2 },
    };
    for (const [type, payload] of Object.entries(payloads)) {
      expect(parseDomainEvent(raw(type, payload))?.type).toBe(type);
    }
  });

  it('rejects unknown types and invalid payloads', () => {
    expect(parseDomainEvent(raw('venta.desconocida', {}))).toBeNull();
    expect(parseDomainEvent(raw('venta.creada', { venta_id: 'v1' }))).toBeNull();
  });

  it('strips fields that are not part of the contract (no secrets leak through)', () => {
    const event = parseDomainEvent(raw('servicio.credenciales_cambiadas', {
      servicio_id: 's1', correo_cambiado: true, contrasena_cambiada: true, contrasena: 'secreto',
    }));
    expect(event && JSON.stringify(event.payload)).not.toContain('secreto');
  });
});

describe('domain event store', () => {
  it('maps claimed rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'e1', type: 'venta.creada', aggregate_type: 'venta', aggregate_id: 'v1', payload: {}, occurred_at: 't', attempts: 1 }],
      error: null,
    });
    const [event] = await createDomainEventStore({ rpc } as never).claim(5, 60);
    expect(rpc).toHaveBeenCalledWith('claim_domain_events', { p_limit: 5, p_lock_seconds: 60 });
    expect(event).toMatchObject({ id: 'e1', aggregateType: 'venta', aggregateId: 'v1', occurredAt: 't' });
  });

  it('returns an empty list and propagates errors by code only', async () => {
    await expect(createDomainEventStore({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } as never).claim(1, 60)).resolves.toEqual([]);
    const failing = createDomainEventStore({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'detail' } }) } as never);
    await expect(failing.claim(1, 60)).rejects.toThrow('Domain event store claim failed: 42501');
  });

  it('finishes with a label or null', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await createDomainEventStore({ rpc } as never).finish('e1', 'HANDLER_ERROR');
    expect(rpc).toHaveBeenCalledWith('finish_domain_event', { p_id: 'e1', p_error: 'HANDLER_ERROR' });
    const failing = createDomainEventStore({ rpc: vi.fn().mockResolvedValue({ error: { code: 'XX000' } }) } as never);
    await expect(failing.finish('e1', null)).rejects.toThrow('finish failed: XX000');
  });
});
