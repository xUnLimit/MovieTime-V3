import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));

import type { PagoVenta } from '@/types';
import { ENTITIES } from './entities';
import { enrichCategorias, enrichTerceros, mapReadRow } from './read-models';

function queryResult(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn(), in: vi.fn(), eq: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

beforeEach(() => mocks.from.mockReset());

describe('mapReadRow pagosVenta', () => {
  it('derives renewal descriptions from the venta period number', () => {
    const pago = mapReadRow<PagoVenta>(ENTITIES.PAGOS_VENTA, {
      id: 'pago-2',
      venta_id: 'venta-1',
      cliente_id: 'cliente-1',
      cliente_nombre: 'Cliente Demo',
      fecha_pago: '2026-05-05T12:00:00.000Z',
      monto_original: 12,
      moneda_original: 'USD',
      metodo_pago_nombre_snapshot: 'Yappy',
      numero_periodo: 3,
      periodo_inicio: '2026-06-01',
      periodo_fin: '2026-07-01',
    });

    expect(pago.descripcion).toBe('Renovación #2');
    expect(pago.numeroPeriodo).toBe(3);
    expect(pago.isPagoInicial).toBe(false);
  });

  it('keeps the initial payment description for period one', () => {
    const pago = mapReadRow<PagoVenta>(ENTITIES.PAGOS_VENTA, {
      id: 'pago-1',
      venta_id: 'venta-1',
      cliente_id: 'cliente-1',
      cliente_nombre: 'Cliente Demo',
      fecha_pago: '2026-05-05T12:00:00.000Z',
      monto_original: 10,
      moneda_original: 'USD',
      metodo_pago_nombre_snapshot: 'Yappy',
      numero_periodo: 1,
      periodo_inicio: '2026-05-01',
      periodo_fin: '2026-06-01',
    });

    expect(pago.descripcion).toBe('Pago inicial');
    expect(pago.isPagoInicial).toBe(true);
  });
});

describe('mapReadRow entity normalization', () => {
  it('normalizes servicios with view fallbacks and defaults', () => {
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.SERVICIOS, {
      plan_tipo_id: 'tipo-1', plan_tipo_nombre: 'Premium', ultimo_costo_original: '12.5',
      ultima_moneda: 'EUR', ultima_renovacion_automatica: true, gastos_total: '3',
    })).toEqual(expect.objectContaining({
      tipo: 'tipo-1', tipoNombre: 'Premium', costoServicio: 12.5, moneda: 'EUR',
      renovacionAutomatica: true, gastosTotal: 3,
    }));
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.SERVICIOS, {})).toEqual(expect.objectContaining({
      tipo: '', costoServicio: 0, moneda: 'USD', renovacionAutomatica: false,
    }));
  });

  it('normalizes ventas from direct, view and default values', () => {
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.VENTAS, {
      ultima_fecha_inicio: '2026-01-01', ultimo_precio_original: '10',
      ultimo_total_original: '9', ultimo_descuento: '1', ultima_moneda: 'PAB',
    })).toEqual(expect.objectContaining({ precio: 10, precioFinal: 9, descuento: 1, moneda: 'PAB' }));
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.VENTAS, {})).toEqual(expect.objectContaining({
      precio: 0, precioFinal: 0, descuento: 0, moneda: 'USD',
    }));
  });

  it('normalizes service payments for initial and renewal periods', () => {
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.PAGOS_SERVICIO, {
      numero_periodo: 2, monto_original: '20', moneda_original: 'EUR', fecha_pago: '2026-01-01',
    })).toEqual(expect.objectContaining({ descripcion: 'Renovacion #1', monto: 20, moneda: 'EUR', isPagoInicial: false }));
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.PAGOS_SERVICIO, {})).toEqual(expect.objectContaining({
      descripcion: 'Pago inicial', monto: 0, moneda: 'USD', isPagoInicial: true,
    }));
  });

  it('normalizes refunded and inferred sale payments', () => {
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.PAGOS_VENTA, {
      is_pago_inicial: false, estado: 'reembolsado', monto_original: '9', precio_original: '10',
    })).toEqual(expect.objectContaining({
      numeroPeriodo: 2, descripcion: 'Reembolso', estado: 'reembolsado', isPagoInicial: false,
      monto: 9, precio: 10, motivoAnulacion: null, destinoReembolso: null,
    }));
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.PAGOS_VENTA, {})).toEqual(expect.objectContaining({
      numeroPeriodo: 1, estado: 'registrado', moneda: 'USD', metodoPago: '', isPagoInicial: true,
    }));
  });

  it('normalizes gastos, templates and generic entities', () => {
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.GASTOS, { monto_original: '4' }).monto).toBe(4);
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.TEMPLATES, { placeholders: 'bad' }).placeholders).toEqual([]);
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.TEMPLATES, { placeholders: ['x'] }).placeholders).toEqual(['x']);
    expect(mapReadRow<Record<string, unknown>>(ENTITIES.CONFIG, { created_at: '2026-01-01T00:00:00Z' }).createdAt)
      .toBeInstanceOf(Date);
  });
});

describe('read model enrichment', () => {
  it('returns terceros unchanged without valid ids', async () => {
    const rows = [{ id: null }, { id: '' }];
    expect(await enrichTerceros(rows)).toBe(rows);
  });

  it('enriches terceros with payment methods and active service counts', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: [{ id: 'm1', nombre: 'Visa', moneda: 'EUR' }], error: null }))
      .mockReturnValueOnce(queryResult({ data: [{ tercero_id: 't1', servicios_activos: '2' }], error: null }));
    const result = await enrichTerceros([
      { id: 't1', metodoPagoId: 'm1' },
      { id: 't2', metodoPagoNombre: 'Manual', moneda: 'PAB' },
    ]);
    expect(result).toEqual([
      expect.objectContaining({ metodoPagoNombre: 'Visa', moneda: 'EUR', serviciosActivos: 2 }),
      expect.objectContaining({ metodoPagoNombre: 'Manual', moneda: 'PAB', serviciosActivos: 0 }),
    ]);
  });

  it('skips method lookup and reports tercero query errors', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }));
    expect(await enrichTerceros([{ id: 't1' }])).toEqual([
      expect.objectContaining({ metodoPagoNombre: 'Pendiente', moneda: 'USD' }),
    ]);
    mocks.from
      .mockReturnValueOnce(queryResult({ data: [], error: { message: 'metodos' } }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }));
    await expect(enrichTerceros([{ id: 't1', metodoPagoId: 'm1' }])).rejects.toThrow('metodos');
    mocks.from
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(queryResult({ data: [], error: { message: 'servicios' } }));
    await expect(enrichTerceros([{ id: 't1', metodoPagoId: 'm1' }])).rejects.toThrow('servicios');
  });

  it('returns categorias unchanged without ids and enriches complete category data', async () => {
    const empty = [{ id: null }];
    expect(await enrichCategorias(empty)).toBe(empty);
    mocks.from
      .mockReturnValueOnce(queryResult({ data: [{ categoria_id: 'c1', id: 't1', nombre: 'Tipo' }], error: null }))
      .mockReturnValueOnce(queryResult({ data: [{ categoria_id: 'c1', id: 'p1', nombre: 'Plan', precio: '8', ciclo_pago: 'mensual', plan_tipo_id: 't1' }], error: null }))
      .mockReturnValueOnce(queryResult({ data: [{ categoria_id: 'c1', total_servicios: '3', servicios_activos: '2', perfiles_disponibles_total: '4' }], error: null }))
      .mockReturnValueOnce(queryResult({ data: [{ categoria_id: 'c1', estado: 'activo' }, { categoria_id: 'c1', estado: 'inactivo' }, { categoria_id: null, estado: 'activo' }], error: null }))
      .mockReturnValueOnce(queryResult({ data: [{ categoria_id: 'c1', ingresos_usd: '20', gastos_usd: '5' }], error: null }));
    expect(await enrichCategorias([{ id: 'c1' }, { id: 'c2', ventasTotales: 7 }])).toEqual([
      expect.objectContaining({ totalServicios: 3, serviciosActivos: 2, perfilesDisponiblesTotal: 4, ventasTotales: 1, ingresosTotales: 20, gastosTotal: 5 }),
      expect.objectContaining({ tiposPlanes: [], planes: [], ventasTotales: 7, ingresosTotales: 0, gastosTotal: 0 }),
    ]);
  });

  it.each([0, 1, 2, 3, 4])('propagates category dependency error %s', async (failedIndex) => {
    for (let index = 0; index < 5; index += 1) {
      mocks.from.mockReturnValueOnce(queryResult({
        data: [], error: index === failedIndex ? { message: `dependency-${index}` } : null,
      }));
    }
    await expect(enrichCategorias([{ id: 'c1' }])).rejects.toThrow(`dependency-${failedIndex}`);
  });
});
