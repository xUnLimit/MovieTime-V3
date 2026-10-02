import { describe, expect, it, vi } from 'vitest';

import type { DomainEventStore, RawDomainEvent } from '@/modules/domain-events';
import { createDomainEventHandlers, dispatchDomainEvents } from './dispatch-domain-events';

const created: RawDomainEvent = {
  id: 'e1', type: 'venta.creada', aggregateType: 'venta', aggregateId: 'v1',
  payload: { venta_id: 'v1', cliente_id: 'c1', servicio_id: 's1', categoria_id: 'k1', estado: 'activo' },
  occurredAt: '2026-10-03T12:00:00Z', attempts: 1,
};

function store(rows: RawDomainEvent[]): DomainEventStore {
  return { claim: vi.fn().mockResolvedValue(rows), finish: vi.fn().mockResolvedValue(undefined) };
}

describe('dispatchDomainEvents', () => {
  it('marks events processed when no handler is registered', async () => {
    const s = store([created]);
    const result = await dispatchDomainEvents({ store: s, handlers: createDomainEventHandlers() }, 50, 120);
    expect(s.claim).toHaveBeenCalledWith(50, 120);
    expect(s.finish).toHaveBeenCalledWith('e1', null);
    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
  });

  it('runs the registered handlers with the typed event', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const handlers = createDomainEventHandlers();
    handlers['venta.creada'].push(handler);
    await dispatchDomainEvents({ store: store([created]), handlers }, 10, 60);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'venta.creada', payload: expect.objectContaining({ venta_id: 'v1' }) }));
  });

  it('releases an event whose handler fails and keeps going', async () => {
    const handlers = createDomainEventHandlers();
    handlers['venta.creada'].push(vi.fn().mockRejectedValue(new Error('boom')));
    const second = { ...created, id: 'e2', type: 'venta.transferida', payload: { venta_id: 'v1', from_servicio_id: 'a', to_servicio_id: 'b' } };
    const s = store([created, second]);
    const result = await dispatchDomainEvents({ store: s, handlers }, 10, 60);
    expect(s.finish).toHaveBeenCalledWith('e1', 'HANDLER_ERROR');
    expect(s.finish).toHaveBeenCalledWith('e2', null);
    expect(result).toEqual({ claimed: 2, processed: 1, failed: 1 });
  });

  it('flags unknown types and invalid payloads', async () => {
    const s = store([{ ...created, type: 'otra.cosa' }, { ...created, id: 'e3', payload: {} }]);
    const result = await dispatchDomainEvents({ store: s, handlers: createDomainEventHandlers() }, 10, 60);
    expect(s.finish).toHaveBeenCalledWith('e1', 'INVALID_EVENT');
    expect(s.finish).toHaveBeenCalledWith('e3', 'INVALID_EVENT');
    expect(result.failed).toBe(2);
  });

  it('counts a failed mark as failed without stopping', async () => {
    const s = store([created, { ...created, id: 'e2' }]);
    vi.mocked(s.finish).mockRejectedValueOnce(new Error('db'));
    const result = await dispatchDomainEvents({ store: s, handlers: createDomainEventHandlers() }, 10, 60);
    expect(result).toEqual({ claimed: 2, processed: 1, failed: 1 });
  });

  it('dispatches every registered type', async () => {
    const seen: string[] = [];
    const handlers = createDomainEventHandlers();
    for (const type of Object.keys(handlers) as Array<keyof typeof handlers>) {
      (handlers[type] as Array<(event: { type: string }) => Promise<void>>).push(async (event) => { seen.push(event.type); });
    }
    const payloads: Array<[string, unknown]> = [
      ['venta.pago_registrado', { venta_id: 'v', pago_id: 'p', periodo_id: 'q', numero_periodo: 1, total_usd: 1, moneda_original: 'USD' }],
      ['venta.reembolsada', { venta_id: 'v', pago_id: 'p', periodo_id: 'q', monto_usd: 1, moneda_original: 'USD', cortada: true }],
      ['servicio.credenciales_cambiadas', { servicio_id: 's', correo_cambiado: true, contrasena_cambiada: false }],
      ['yappy.pago_detectado', { payment_id: 'y', match_status: 'sin_match', amount: 1 }],
      ['yappy.pago_resuelto', { payment_id: 'y', venta_id: 'v', amount: 1, resolved_by: null }],
      ['pedido.pago_reclamado', { pedido_id: 'p', payment_id: 'y', resultado: 'confirmado', monto: 1, faltante: 0, estado: 'entregado' }],
      ['pedido.pago_en_revision', { pedido_id: 'p', motivo: 'monto_menor', faltante: 1 }],
    ];
    const rows = payloads.map(([type, payload], i) => ({ ...created, id: `x${i}`, type, payload }));
    await dispatchDomainEvents({ store: store(rows), handlers }, 10, 60);
    expect(seen).toEqual(payloads.map(([type]) => type));
  });
});
