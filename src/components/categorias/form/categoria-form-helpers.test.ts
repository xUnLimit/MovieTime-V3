import { describe, expect, it } from 'vitest';
import type { Categoria } from '@/types';
import {
  getAsociadoLabel,
  hasCategoriaChanges,
} from './categoria-form-helpers';

const categoria: Categoria = {
  id: 'categoria-1',
  nombre: 'Netflix',
  tipo: 'cliente',
  tipoCategoria: 'plataforma_streaming',
  notas: 'Nota guardada',
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('categoria form helpers', () => {
  it('labels categories associated with clients', () => {
    expect(getAsociadoLabel('cliente')).toBe('Cliente');
  });

  it('detects no changes when notes and plans match the saved category', () => {
    expect(
      hasCategoriaChanges({
        categoria,
        mode: 'edit',
        nombreValue: categoria.nombre,
        notasValue: categoria.notas,
        planes: categoria.planes ?? [],
        tipoCategoriaValue: categoria.tipoCategoria,
        tipoValue: categoria.tipo,
        tiposPlanes: categoria.tiposPlanes ?? [],
      })
    ).toBe(false);
  });

  it('detects note changes', () => {
    expect(
      hasCategoriaChanges({
        categoria,
        mode: 'edit',
        nombreValue: categoria.nombre,
        notasValue: 'Nota actualizada',
        planes: categoria.planes ?? [],
        tipoCategoriaValue: categoria.tipoCategoria,
        tipoValue: categoria.tipo,
        tiposPlanes: categoria.tiposPlanes ?? [],
      })
    ).toBe(true);
  });
});
