import { describe, expect, it } from 'vitest';

import { queryKeys } from './query-keys';

describe('queryKeys', () => {
  it('builds stable and namespaced keys for every query family', () => {
    const keys = [
      queryKeys.pagination.page('ventas', 'estado=activa', 10, 2, 'fecha', true),
      queryKeys.dashboard.home(), queryKeys.dashboard.stats(), queryKeys.dashboard.churn(),
      queryKeys.dashboard.montoSinConsumir('sig'), queryKeys.dashboard.pronostico('sig', 6, true),
      queryKeys.ventas.lists(), queryKeys.ventas.list({ estado: 'activa' }), queryKeys.ventas.counts(),
      queryKeys.ventas.detail('v1'), queryKeys.ventas.edit('v1'), queryKeys.ventas.pagos('v1'),
      queryKeys.ventas.pagosTotalUsd('sig'), queryKeys.ventas.byTercero('t1'),
      queryKeys.ventas.byTerceros('t1,t2'), queryKeys.ventas.byServicio('s1'),
      queryKeys.ventas.activeByServicios('s1,s2'), queryKeys.ventas.activeByServicios('s1', 'v2'),
      queryKeys.servicios.lists(), queryKeys.servicios.list({ activo: true }), queryKeys.servicios.counts(),
      queryKeys.servicios.reposo(), queryKeys.servicios.byCategoria('c1'), queryKeys.servicios.byIds('s1,s2'),
      queryKeys.servicios.detail('s1'), queryKeys.servicios.detailBundle('s1'),
      queryKeys.servicios.ventas('s1'), queryKeys.servicios.pagos('s1'),
      queryKeys.servicios.pagosTotalUsd('sig'), queryKeys.servicios.proximosPagosByCategoria('c1'),
      queryKeys.categorias.full(), queryKeys.categorias.detail('c1'), queryKeys.categorias.counts(),
      queryKeys.categorias.ventasMontos('sig'), queryKeys.metodosPago.lists(),
      queryKeys.metodosPago.list({ activo: true }), queryKeys.metodosPago.counts(),
      queryKeys.metodosPago.detail('m1'), queryKeys.metodosPago.terceros(),
      queryKeys.metodosPago.tercerosOptions(), queryKeys.metodosPago.tercerosWithPending(),
      queryKeys.metodosPago.servicios(), queryKeys.terceros.lists(), queryKeys.terceros.list({ q: 'ana' }),
      queryKeys.terceros.counts(), queryKeys.terceros.detail('t1'), queryKeys.templates.list(),
      queryKeys.gastos.list(), queryKeys.tiposGasto.list(), queryKeys.config.global(),
      queryKeys.notificaciones.lists(), queryKeys.notificaciones.byEntity('venta'),
      queryKeys.notificaciones.montos('sig'),
    ];

    expect(keys).toHaveLength(53);
    expect(keys.every((key) => Array.isArray(key) && key.length >= 2)).toBe(true);
    expect(queryKeys.ventas.activeByServicios('s1')).toEqual(['ventas', 'active-by-servicios', 's1', null]);
    expect(queryKeys.ventas.activeByServicios('s1', 'v2')).toEqual(['ventas', 'active-by-servicios', 's1', 'v2']);
    expect(queryKeys.servicios.detailBundle('s1')).toEqual(['servicios', 'detail', 's1', 'bundle']);
  });
});
