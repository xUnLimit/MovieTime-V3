import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Servicio, VentaDoc } from '@/types';
import { rankServicios } from './servicioRanking';

function servicio(overrides: Partial<Servicio> & Pick<Servicio, 'id'>): Servicio {
  return {
    categoriaId: 'categoria-1',
    categoriaNombre: 'Streaming',
    nombre: overrides.id,
    tipo: 'tipo-1',
    correo: `${overrides.id}@example.com`,
    contrasena: 'secret',
    perfilesDisponibles: 5,
    perfilesOcupados: 0,
    costoServicio: 0,
    gastosTotal: 0,
    activo: true,
    renovacionAutomatica: false,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    createdBy: 'user-1',
    ...overrides,
  };
}

function venta(overrides: Partial<VentaDoc> & Pick<VentaDoc, 'servicioId'>): VentaDoc {
  const { servicioId, ...rest } = overrides;
  return {
    id: `${servicioId}-venta`,
    clienteNombre: 'Cliente',
    servicioNombre: 'Servicio',
    categoriaId: 'categoria-1',
    servicioId,
    estado: 'activo',
    perfilNumero: 1,
    fechaInicio: new Date(2026, 4, 1),
    fechaFin: new Date(2026, 4, 16),
    cicloPago: 'mensual',
    ...rest,
  };
}

describe('rankServicios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 6));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prioritizes empty services and orders them by most recent creation date', () => {
    const oldEmpty = servicio({
      id: 'empty-old',
      createdAt: new Date(2025, 0, 1),
    });
    const occupied = servicio({ id: 'occupied' });
    const newEmpty = servicio({
      id: 'empty-new',
      createdAt: new Date(2026, 0, 1),
    });

    const ranked = rankServicios(
      [occupied, oldEmpty, newEmpty],
      {
        occupied: [venta({ servicioId: 'occupied' })],
      },
      {
        planCicloPago: 'mensual',
        fechaInicio: new Date(2026, 4, 6),
        fechaFin: new Date(2026, 5, 6),
      },
    );

    expect(ranked.map((item) => item.id)).toEqual([
      'empty-new',
      'empty-old',
      'occupied',
    ]);
  });

  it('compares occupied services against the selected end date', () => {
    const nearExpiration = servicio({ id: 'near-expiration' });
    const farExpiration = servicio({ id: 'far-expiration' });

    const ranked = rankServicios(
      [farExpiration, nearExpiration],
      {
        'near-expiration': [
          venta({
            servicioId: 'near-expiration',
            fechaFin: new Date(2026, 4, 16),
          }),
        ],
        'far-expiration': [
          venta({
            servicioId: 'far-expiration',
            fechaFin: new Date(2026, 5, 5),
          }),
        ],
      },
      {
        planCicloPago: 'anual',
        fechaInicio: new Date(2026, 4, 6),
        fechaFin: new Date(2026, 4, 16),
      },
    );

    expect(ranked[0]?.id).toBe('near-expiration');
  });

  it('uses fetched active ventas for the available-slot tie breaker', () => {
    const staleLowAvailability = servicio({
      id: 'stale-low-availability',
      perfilesOcupados: 4,
    });
    const staleHighAvailability = servicio({
      id: 'stale-high-availability',
      perfilesOcupados: 0,
    });

    const ranked = rankServicios(
      [staleHighAvailability, staleLowAvailability],
      {
        'stale-low-availability': [
          venta({ servicioId: 'stale-low-availability', perfilNumero: 1 }),
        ],
        'stale-high-availability': [
          venta({ servicioId: 'stale-high-availability', perfilNumero: 1 }),
          venta({ servicioId: 'stale-high-availability', perfilNumero: 2 }),
        ],
      },
      {
        planCicloPago: 'mensual',
        fechaInicio: new Date(2026, 4, 6),
        fechaFin: new Date(2026, 4, 16),
      },
    );

    expect(ranked[0]?.id).toBe('stale-low-availability');
  });
});
