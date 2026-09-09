import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Categoria } from '@/types';

vi.mock('@/platform/supabase/categorias-repository', () => ({
  buildCategorias: vi.fn(),
  createCategoriaRecord: vi.fn(),
  deleteCategoriaRecord: vi.fn(),
  getCategoriasCounts: vi.fn(),
  getCategoriasFull: vi.fn(),
  getCategoriaById: vi.fn(),
  updateCategoriaRecord: vi.fn(),
  upsertCategoriaPlanes: vi.fn(),
}));

vi.mock('@/platform/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

import {
  buildCategorias,
  createCategoriaRecord,
  deleteCategoriaRecord,
  upsertCategoriaPlanes,
} from '@/platform/supabase/categorias-repository';
import { createCategoriaUseCase, deleteCategoriaUseCase } from './categorias-use-cases';

const baseCategoria: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'> = {
  nombre: 'Netflix',
  tipo: 'cliente',
  tipoCategoria: 'plataforma_streaming',
  notas: 'Nota de creación',
  tiposPlanes: [{ id: 'tipo-1', nombre: 'Individual' }],
  planes: [{
    id: 'plan-1',
    nombre: 'Mensual',
    precio: 5,
    cicloPago: 'mensual',
    tipoPlan: 'tipo-1',
  }],
  activo: true,
  totalServicios: 0,
  serviciosActivos: 0,
  perfilesDisponiblesTotal: 0,
  ventasTotales: 0,
  ingresosTotales: 0,
  gastosTotal: 0,
};

describe('createCategoriaUseCase', () => {
  beforeEach(() => {
    vi.mocked(createCategoriaRecord).mockReset();
    vi.mocked(deleteCategoriaRecord).mockReset();
    vi.mocked(upsertCategoriaPlanes).mockReset();
    vi.mocked(buildCategorias).mockReset();
  });

  it('persists category notes on creation', async () => {
    const createdRow = {
      id: 'categoria-1',
      nombre: 'Netflix',
      tipo: 'cliente' as const,
      tipo_categoria: 'plataforma_streaming' as const,
      notas: 'Nota de creación',
      activo: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      created_by: null,
    };
    const builtCategoria: Categoria = {
      ...baseCategoria,
      id: 'categoria-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    vi.mocked(createCategoriaRecord).mockResolvedValue(createdRow);
    vi.mocked(upsertCategoriaPlanes).mockResolvedValue(undefined);
    vi.mocked(buildCategorias).mockResolvedValue([builtCategoria]);

    await createCategoriaUseCase(baseCategoria, {
      logContext: {
        usuarioId: 'user-1',
        usuarioEmail: 'user@example.com',
      },
    });

    expect(createCategoriaRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Netflix',
        notas: 'Nota de creación',
      })
    );
  });
});

describe('deleteCategoriaUseCase', () => {
  beforeEach(() => {
    vi.mocked(deleteCategoriaRecord).mockReset();
  });

  it('hard deletes the category record through the repository', async () => {
    vi.mocked(deleteCategoriaRecord).mockResolvedValue(undefined);

    await deleteCategoriaUseCase('categoria-1', {
      categoria: {
        ...baseCategoria,
        id: 'categoria-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      logContext: {
        usuarioId: 'user-1',
        usuarioEmail: 'user@example.com',
      },
    });

    expect(deleteCategoriaRecord).toHaveBeenCalledWith('categoria-1');
  });
});
