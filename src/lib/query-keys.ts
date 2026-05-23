export const queryKeys = {
  pagination: {
    all: ['pagination'] as const,
    page: (
      collectionName: string,
      filtersKey: string,
      pageSize: number,
      pageIndex: number,
      orderKey: string,
      includeTotalCount: boolean,
      refreshKey: number,
    ) =>
      [
        ...queryKeys.pagination.all,
        collectionName,
        filtersKey,
        pageSize,
        pageIndex,
        orderKey,
        includeTotalCount,
        refreshKey,
      ] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    home: () => [...queryKeys.dashboard.all, 'home'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    churn: () => [...queryKeys.dashboard.all, 'churn'] as const,
    montoSinConsumir: (signature: string) =>
      [...queryKeys.dashboard.all, 'monto-sin-consumir', signature] as const,
    pronostico: (signature: string, monthsCount: number, endAtCurrentYear: boolean) =>
      [...queryKeys.dashboard.all, 'pronostico', signature, monthsCount, endAtCurrentYear] as const,
  },
  ventas: {
    all: ['ventas'] as const,
    lists: () => [...queryKeys.ventas.all, 'list'] as const,
    list: (filters: unknown) => [...queryKeys.ventas.lists(), filters] as const,
    detail: (ventaId: string) => [...queryKeys.ventas.all, 'detail', ventaId] as const,
    pagos: (ventaId: string) => [...queryKeys.ventas.detail(ventaId), 'pagos'] as const,
    pagosTotalUsd: (signature: string) =>
      [...queryKeys.ventas.all, 'pagos-total-usd', signature] as const,
    byTercero: (terceroId: string) => [...queryKeys.ventas.all, 'tercero', terceroId] as const,
    byTerceros: (tercerosKey: string) => [...queryKeys.ventas.all, 'terceros', tercerosKey] as const,
    byServicio: (servicioId: string) => [...queryKeys.ventas.all, 'servicio', servicioId] as const,
    activeByServicios: (serviciosKey: string, excludeVentaId?: string) =>
      [...queryKeys.ventas.all, 'active-by-servicios', serviciosKey, excludeVentaId ?? null] as const,
  },
  servicios: {
    all: ['servicios'] as const,
    lists: () => [...queryKeys.servicios.all, 'list'] as const,
    list: (filters: unknown) => [...queryKeys.servicios.lists(), filters] as const,
    reposo: () => [...queryKeys.servicios.all, 'reposo'] as const,
    byCategoria: (categoriaId: string) => [...queryKeys.servicios.all, 'categoria', categoriaId] as const,
    byIds: (serviciosKey: string) => [...queryKeys.servicios.all, 'ids', serviciosKey] as const,
    detail: (servicioId: string) => [...queryKeys.servicios.all, 'detail', servicioId] as const,
    pagos: (servicioId: string) => [...queryKeys.servicios.detail(servicioId), 'pagos'] as const,
    pagosTotalUsd: (signature: string) =>
      [...queryKeys.servicios.all, 'pagos-total-usd', signature] as const,
    proximosPagosByCategoria: (categoriaId: string) =>
      [...queryKeys.servicios.all, 'proximos-pagos', 'categoria', categoriaId] as const,
  },
  categorias: {
    all: ['categorias'] as const,
    full: () => [...queryKeys.categorias.all, 'full'] as const,
    detail: (categoriaId: string) => [...queryKeys.categorias.all, 'detail', categoriaId] as const,
    counts: () => [...queryKeys.categorias.all, 'counts'] as const,
    ventasMontos: (signature: string) => [...queryKeys.categorias.all, 'ventas-montos', signature] as const,
  },
  metodosPago: {
    all: ['metodos-pago'] as const,
    detail: (metodoPagoId: string) => [...queryKeys.metodosPago.all, 'detail', metodoPagoId] as const,
    terceros: () => [...queryKeys.metodosPago.all, 'terceros'] as const,
    tercerosOptions: () => [...queryKeys.metodosPago.all, 'terceros-options'] as const,
    tercerosWithPending: () => [...queryKeys.metodosPago.all, 'terceros-with-pending'] as const,
    servicios: () => [...queryKeys.metodosPago.all, 'servicios'] as const,
  },
  terceros: {
    all: ['terceros'] as const,
    lists: () => [...queryKeys.terceros.all, 'list'] as const,
    detail: (terceroId: string) => [...queryKeys.terceros.all, 'detail', terceroId] as const,
  },
  notificaciones: {
    all: ['notificaciones'] as const,
    lists: () => [...queryKeys.notificaciones.all, 'list'] as const,
    byEntity: (entity: 'venta' | 'servicio' | 'reposo') =>
      [...queryKeys.notificaciones.all, 'entity', entity] as const,
    montos: (signature: string) => [...queryKeys.notificaciones.all, 'montos', signature] as const,
  },
};
