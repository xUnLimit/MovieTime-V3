import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Gasto, TipoGasto } from '@/types';
import {
  createGastoUseCase, deleteGastoUseCase, fetchGastosUseCase,
  fetchTiposGastoUseCase, updateGastoUseCase,
} from './gastos-use-cases';
import {
  createGasto, getGastoById, getGastos, getTipoGastoById, getTiposGasto,
  removeGasto, updateGasto,
} from '@/platform/supabase/catalogos-repository';

vi.mock('@/platform/supabase/catalogos-repository', () => ({
  createGasto: vi.fn(), getGastoById: vi.fn(), getGastos: vi.fn(),
  getTipoGastoById: vi.fn(), getTiposGasto: vi.fn(), removeGasto: vi.fn(), updateGasto: vi.fn(),
}));

const tipo: TipoGasto = {
  id: 'tipo-1', nombre: 'Servicios', activo: true,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
};
const gasto: Gasto = {
  id: 'gasto-1', tipoGastoId: tipo.id, tipoGastoNombre: tipo.nombre,
  fecha: new Date('2026-01-02'), monto: 10, detalle: 'uno',
  createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02'),
};

describe('casos de uso de gastos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTipoGastoById).mockResolvedValue(tipo);
    vi.mocked(getGastoById).mockResolvedValue(gasto);
    vi.mocked(createGasto).mockResolvedValue('gasto-2');
    vi.mocked(updateGasto).mockResolvedValue(undefined);
    vi.mocked(removeGasto).mockResolvedValue(undefined);
  });

  it('ordena gastos por fecha y desempata por creacion', async () => {
    vi.mocked(getGastos).mockResolvedValue([
      gasto,
      { ...gasto, id: 'gasto-2', createdAt: new Date('2026-01-03') },
      { ...gasto, id: 'gasto-3', fecha: new Date('2026-01-01') },
    ]);
    expect((await fetchGastosUseCase()).map((item) => item.id)).toEqual(['gasto-2', 'gasto-1', 'gasto-3']);
  });

  it('ordena tipos por nombre sin distinguir mayusculas', async () => {
    vi.mocked(getTiposGasto).mockResolvedValue([{ ...tipo, nombre: 'zeta' }, { ...tipo, nombre: 'Árbol' }]);
    expect((await fetchTiposGastoUseCase()).map((item) => item.nombre)).toEqual(['Árbol', 'zeta']);
  });

  it('normaliza el detalle y conserva el nombre del tipo al crear', async () => {
    const result = await createGastoUseCase({ tipoGastoId: tipo.id, fecha: gasto.fecha, monto: 10, detalle: '  pago  ' });
    expect(createGasto).toHaveBeenCalledWith(expect.objectContaining({ detalle: 'pago' }));
    expect(result.gasto).toMatchObject({ id: 'gasto-2', tipoGastoNombre: 'Servicios', detalle: 'pago' });
  });

  it('rechaza un tipo inactivo antes de crear', async () => {
    vi.mocked(getTipoGastoById).mockResolvedValue({ ...tipo, activo: false });
    await expect(createGastoUseCase({ tipoGastoId: tipo.id, fecha: gasto.fecha, monto: 10 })).rejects.toThrow('inactivo');
    expect(createGasto).not.toHaveBeenCalled();
  });

  it('rechaza un tipo inexistente antes de crear', async () => {
    vi.mocked(getTipoGastoById).mockResolvedValue(null);
    await expect(createGastoUseCase({ tipoGastoId: 'missing', fecha: gasto.fecha, monto: 10 })).rejects.toThrow('Tipo de gasto no encontrado');
    expect(createGasto).not.toHaveBeenCalled();
  });

  it('marca recalculo al cambiar monto y no escribe el nombre derivado', async () => {
    vi.mocked(getTipoGastoById).mockResolvedValue({ ...tipo, id: 'tipo-2', nombre: 'Otro' });
    const result = await updateGastoUseCase(gasto.id, { monto: 20, tipoGastoId: 'tipo-2', detalle: '  ' });
    expect(result.shouldInvalidateDashboard).toBe(true);
    expect(result.gastoActualizado.tipoGastoNombre).toBe('Otro');
    expect(updateGasto).toHaveBeenCalledWith(gasto.id, { monto: 20, tipoGastoId: 'tipo-2', detalle: undefined });
  });

  it('no recalcula por un cambio solo de detalle', async () => {
    expect((await updateGastoUseCase(gasto.id, { detalle: ' nuevo ' })).shouldInvalidateDashboard).toBe(false);
  });

  it('recalcula al cambiar la fecha aunque el monto siga igual', async () => {
    expect((await updateGastoUseCase(gasto.id, { fecha: new Date('2026-02-01') })).shouldInvalidateDashboard).toBe(true);
  });

  it('rechaza actualizar o eliminar un gasto inexistente', async () => {
    vi.mocked(getGastoById).mockResolvedValue(null);
    await expect(updateGastoUseCase('missing', { monto: 2 })).rejects.toThrow('Gasto no encontrado');
    await expect(deleteGastoUseCase('missing')).rejects.toThrow('Gasto no encontrado');
  });

  it('elimina y devuelve el gasto anterior', async () => {
    await expect(deleteGastoUseCase(gasto.id)).resolves.toEqual({ gasto });
    expect(removeGasto).toHaveBeenCalledWith(gasto.id);
  });
});
