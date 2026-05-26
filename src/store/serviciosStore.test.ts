import { beforeEach, describe, expect, it } from 'vitest';

import type { Servicio } from '@/types/servicios';

const baseServicio: Servicio = {
  id: 'servicio-1',
  categoriaId: 'categoria-1',
  categoriaNombre: 'Streaming',
  nombre: 'Netflix',
  tipo: 'premium',
  correo: 'netflix@test.com',
  contrasena: 'secret',
  perfilesDisponibles: 4,
  perfilesOcupados: 2,
  costoServicio: 10,
  gastosTotal: 0,
  activo: true,
  renovacionAutomatica: false,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  createdBy: 'admin-1',
};

describe('useServiciosStore', () => {
  beforeEach(async () => {
    const { useServiciosStore } = await import('./serviciosStore');
    useServiciosStore.setState({
      error: null,
      selectedServicio: null,
    });
  });

  it('keeps only UI state and does not expose remote mutation APIs', async () => {
    const { useServiciosStore } = await import('./serviciosStore');
    const state = useServiciosStore.getState() as Record<string, unknown>;

    expect(state.fetchServicios).toBeUndefined();
    expect(state.fetchCounts).toBeUndefined();
    expect(state.createServicio).toBeUndefined();
    expect(state.updateServicio).toBeUndefined();
    expect(state.deleteServicio).toBeUndefined();
    expect(state.updatePerfilOcupado).toBeUndefined();
  });

  it('stores the selected servicio locally', async () => {
    const { useServiciosStore } = await import('./serviciosStore');

    useServiciosStore.getState().setSelectedServicio(baseServicio);

    expect(useServiciosStore.getState().selectedServicio).toEqual(baseServicio);
  });
});
