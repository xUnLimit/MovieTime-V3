import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TipoGasto } from '@/types';
import {
  createTipoGastoUseCase, deleteTipoGastoUseCase,
  getTipoGastoUseCase, updateTipoGastoUseCase,
} from './tipos-gasto-use-cases';
import {
  countGastos, createTipoGasto, getTipoGastoById, getTiposGasto,
  removeTipoGasto, updateTipoGasto,
} from '@/platform/supabase/catalogos-repository';

vi.mock('@/platform/supabase/catalogos-repository', () => ({
  countGastos: vi.fn(), createTipoGasto: vi.fn(), getTipoGastoById: vi.fn(),
  getTiposGasto: vi.fn(), removeTipoGasto: vi.fn(), updateTipoGasto: vi.fn(),
}));

const tipo: TipoGasto = {
  id: 'tipo-1', nombre: 'Servicios', activo: true,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
};

describe('casos de uso de tipos de gasto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTipoGastoById).mockResolvedValue(tipo);
    vi.mocked(getTiposGasto).mockResolvedValue([tipo]);
    vi.mocked(countGastos).mockResolvedValue(0);
  });

  it('consulta un tipo por id', async () => {
    await expect(getTipoGastoUseCase(tipo.id)).resolves.toEqual(tipo);
  });

  it('recorta el nombre antes de crear', async () => {
    await createTipoGastoUseCase({ nombre: '  Otro  ', activo: true });
    expect(createTipoGasto).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Otro' }));
  });

  it('rechaza nombres vacios y duplicados sin escribir', async () => {
    await expect(createTipoGastoUseCase({ nombre: ' ', activo: true })).rejects.toThrow('obligatorio');
    await expect(createTipoGastoUseCase({ nombre: ' servicios ', activo: true })).rejects.toThrow('Ya existe');
    expect(createTipoGasto).not.toHaveBeenCalled();
  });

  it('normaliza y valida un cambio de nombre', async () => {
    const result = await updateTipoGastoUseCase(tipo.id, { nombre: '  Nuevo  ' });
    expect(result.finalUpdates.nombre).toBe('Nuevo');
    expect(updateTipoGasto).toHaveBeenCalledWith(tipo.id, { nombre: 'Nuevo' });
    await expect(updateTipoGastoUseCase(tipo.id, { nombre: '  ' })).rejects.toThrow('obligatorio');
  });

  it('omite comprobacion de duplicado si solo cambia el formato del mismo nombre', async () => {
    await updateTipoGastoUseCase(tipo.id, { nombre: '  SERVICIOS  ' });
    expect(getTiposGasto).not.toHaveBeenCalled();
  });

  it('rechaza actualizar o eliminar tipos inexistentes', async () => {
    vi.mocked(getTipoGastoById).mockResolvedValue(null);
    await expect(updateTipoGastoUseCase('missing', { activo: false })).rejects.toThrow('no encontrado');
    await expect(deleteTipoGastoUseCase('missing')).rejects.toThrow('no encontrado');
  });

  it('impide eliminar un tipo con gastos asociados', async () => {
    vi.mocked(countGastos).mockResolvedValue(1);
    await expect(deleteTipoGastoUseCase(tipo.id)).rejects.toThrow('gastos asociados');
    expect(removeTipoGasto).not.toHaveBeenCalled();
  });

  it('elimina un tipo sin gastos asociados', async () => {
    await deleteTipoGastoUseCase(tipo.id);
    expect(removeTipoGasto).toHaveBeenCalledWith(tipo.id);
  });
});
