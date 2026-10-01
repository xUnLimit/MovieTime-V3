import { describe, expect, it } from 'vitest';
import { buildExecutivePushSummaryBlocks } from './executive-push-summary-blocks';

describe('buildExecutivePushSummaryBlocks', () => {
  it('deduplicates customers, totals valid currencies and preserves the selected order', () => {
    const blocks = buildExecutivePushSummaryBlocks({
      ventaNotifications: [{ cliente_id: 'ana' }, { cliente_id: 'ana' }, { cliente_id: 'luis' }, { cliente_id: null }],
      servicioNotifications: [
        { costo_servicio_snapshot: '12.5', moneda_snapshot: 'usd' },
        { costo_servicio_snapshot: 2.5, moneda_snapshot: null },
        { costo_servicio_snapshot: 'bad', moneda_snapshot: 'EUR' },
        { costo_servicio_snapshot: 8, moneda_snapshot: 'eur' },
      ],
      reposoCount: 3,
      settings: {
        selectedBlocks: ['clientes_por_notificar', 'monto_a_fondear', 'reposo_terminado'],
        blockOrder: ['monto_a_fondear', 'servicios_por_pagar', 'clientes_por_notificar', 'reposo_terminado'],
      },
    });

    expect(blocks.map((block) => block.key)).toEqual(['monto_a_fondear', 'clientes_por_notificar', 'reposo_terminado']);
    expect(blocks[0]).toMatchObject({ amounts: { USD: 15, EUR: 8 }, destination: '/dashboard' });
    expect(blocks[1]).toMatchObject({ count: 2, destination: '/notificaciones', tab: 'ventas' });
    expect(blocks[2]).toMatchObject({ count: 3, tab: 'reposo' });
    expect(blocks.every((block) => block.label.length > 0)).toBe(true);
  });
});
