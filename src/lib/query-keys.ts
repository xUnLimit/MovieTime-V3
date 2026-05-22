export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
    home: () => [...queryKeys.dashboard.all, 'home'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    churn: () => [...queryKeys.dashboard.all, 'churn'] as const,
  },
  ventas: {
    all: ['ventas'] as const,
    lists: () => [...queryKeys.ventas.all, 'list'] as const,
    list: (filters: unknown) => [...queryKeys.ventas.lists(), filters] as const,
    detail: (ventaId: string) => [...queryKeys.ventas.all, 'detail', ventaId] as const,
    pagos: (ventaId: string) => [...queryKeys.ventas.detail(ventaId), 'pagos'] as const,
    byTercero: (terceroId: string) => [...queryKeys.ventas.all, 'tercero', terceroId] as const,
  },
  servicios: {
    all: ['servicios'] as const,
    lists: () => [...queryKeys.servicios.all, 'list'] as const,
    list: (filters: unknown) => [...queryKeys.servicios.lists(), filters] as const,
    detail: (servicioId: string) => [...queryKeys.servicios.all, 'detail', servicioId] as const,
    pagos: (servicioId: string) => [...queryKeys.servicios.detail(servicioId), 'pagos'] as const,
  },
  categorias: {
    all: ['categorias'] as const,
    full: () => [...queryKeys.categorias.all, 'full'] as const,
    counts: () => [...queryKeys.categorias.all, 'counts'] as const,
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
  },
};
